const path = require('path')
const _ = require('lodash')
const fs = require('fs');
const jsonFile = require('jsonfile')
const es = require('@elastic/elasticsearch')
const querystring = require('querystring')

function adjustIndexName (indexName, entityType, config) {
  if (parseInt(config.elasticsearch.apiVersion) < 6) {
    return indexName
  } else {
    return `${indexName}_${entityType}`
  }
}

function decorateBackendUrl (entityType, url, req, config) {
  if (config.elasticsearch.useRequestFilter && typeof config.entities[entityType] === 'object') {
    const urlParts = url.split('?')
    const { includeFields, excludeFields } = config.entities[entityType]

    const filteredParams = Object.keys(req.query)
      .filter(key => !config.elasticsearch.requestParamsBlacklist.includes(key))
      .reduce((object, key) => {
        object[key] = req.query[key]
        return object
      }, {})

    let _source_include = includeFields || []
    let _source_exclude = excludeFields || []

    if (!config.elasticsearch.overwriteRequestSourceParams) {
      const requestSourceInclude = req.query._source_include || []
      const requestSourceExclude = req.query._source_exclude || []
      _source_include = [...includeFields, ...requestSourceInclude]
      _source_exclude = [...excludeFields, ...requestSourceExclude]
    }

    const urlParams = {
      ...filteredParams,
      _source_include,
      _source_exclude
    }
    url = `${urlParts[0]}?${querystring.stringify(urlParams)}`
  }

  return url
}

function adjustBackendProxyUrl (req, indexName, entityType, config) {
  let url
  const queryString = require('query-string');
  const parsedQuery = queryString.parseUrl(req.url).query

  if (parseInt(config.elasticsearch.apiVersion) < 6) { // legacy for ES 5
    delete parsedQuery.request
    delete parsedQuery.request_format
    delete parsedQuery.response_format
    url = config.elasticsearch.host + ':' + config.elasticsearch.port + '/' + indexName + '/' + entityType + '/_search?' + queryString.stringify(parsedQuery)
  } else {
    parsedQuery._source_includes = parsedQuery._source_include
    parsedQuery._source_excludes = parsedQuery._source_exclude
    delete parsedQuery._source_exclude
    delete parsedQuery._source_include
    delete parsedQuery.request
    delete parsedQuery.request_format
    delete parsedQuery.response_format
    if (config.elasticsearch.cacheRequest) {
      parsedQuery.request_cache = !!config.elasticsearch.cacheRequest
    }

    url = config.elasticsearch.host + ':' + config.elasticsearch.port + '/' + adjustIndexName(indexName, entityType, config) + '/_search?' + queryString.stringify(parsedQuery)
  }
  if (!url.startsWith('http')) {
    url = config.elasticsearch.protocol + '://' + url
  }

  return decorateBackendUrl(entityType, url, req, config)
}

function adjustQueryParams (query, config) {
  if (parseInt(config.elasticsearch.apiVersion) < 6) { // legacy for ES 5
    delete query.request
    delete query.request_format
    delete query.response_format
  } else {
    query._source_includes = query._source_include
    query._source_excludes = query._source_exclude
    delete query._source_exclude
    delete query._source_include
    delete query.request
    delete query.request_format
    delete query.response_format
  }

  return query
}

function adjustQuery (esQuery, entityType, config) {
  if (parseInt(config.elasticsearch.apiVersion) < 6) {
    esQuery.type = entityType
  }
  esQuery.index = adjustIndexName(esQuery.index, entityType, config)
  return esQuery
}

function getHits (result) {
  if (result.body) { // differences between ES5 and ES7
    return result.body.hits.hits
  } else {
    return result.hits.hits
  }
}

/**
 * Support for ES7+ where the `total` now is an object
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/current/breaking-changes-7.0.html
 */
const getTotals = body => typeof body.hits.total === 'object' ? body.hits.total.value : body.hits.total

let esClient = null
function getClient (config) {
  let { host, port, protocol, apiVersion, requestTimeout, pingTimeout } = config.elasticsearch

  let nodes = []
  let hosts = typeof host === 'string' ? host.split(',') : host

  hosts.forEach(host => {
    const node = `${protocol}://${host}:${port}`
    nodes.push(node)
  })

  let auth
  if (config.elasticsearch.user) {
    const { user, password } = config.elasticsearch
    auth = { username: user, password }
  }

  if (!esClient) {
    esClient = new es.Client({ nodes, auth, apiVersion, requestTimeout, pingTimeout })
  }

  return esClient
}

function putAlias (db, originalName, aliasName, next) {
  let step2 = () => {
    db.indices.putAlias({ index: originalName, name: aliasName }).then(result => {
      console.log('Index alias created')
    }).then(next).catch(err => {
      console.log(err.message)
      next()
    })
  }
  return db.indices.deleteAlias({
    index: aliasName,
    name: originalName
  }).then((result) => {
    console.log('Public index alias deleted')
    step2()
  }).catch((err) => {
    console.log('Public index alias does not exists', err.message)
    step2()
  })
}

function search (db, query) {
  return db.search(query)
}

function deleteIndex (db, indexName, next) {
  db.indices.delete({
    'index': indexName
  }).then((res) => {
    next()
  }).catch(err => {
    if (err) {
      console.error(err)
    }
    return db.indices.deleteAlias({
      index: '*',
      name: indexName
    }).then((result) => {
      console.log('Public index alias deleted')
      next()
    }).catch((err) => {
      console.log('Public index alias does not exists', err.message)
      next()
    })
  })
}

function reIndex (db, fromIndexName, toIndexName, next) {
  db.reindex({
    wait_for_completion: true,
    waitForCompletion: true,
    body: {
      'source': {
        'index': fromIndexName
      },
      'dest': {
        'index': toIndexName
      }
    }
  }).then(res => {
    next()
  }).catch(err => {
    next(err)
  })
}

/**
 * Load the schema definition for particular entity type
 * @param {String} entityType
 */
function loadSchema (entityType, apiVersion = '7.1') {
  const rootSchemaPath = path.join(__dirname, '../../config/elastic.schema.' + entityType + '.json')
  if (!fs.existsSync(rootSchemaPath)) {
    return null
  }
  let schemaContent = jsonFile.readFileSync(rootSchemaPath)
  let elasticSchema = parseInt(apiVersion) < 6 ? schemaContent : Object.assign({}, { mappings: schemaContent });
  const extensionsPath = path.join(__dirname, '../../config/elastic.schema.' + entityType + '.extension.json');
  if (fs.existsSync(extensionsPath)) {
    schemaContent = jsonFile.readFileSync(extensionsPath)
    let elasticSchemaExtensions = parseInt(apiVersion) < 6 ? schemaContent : Object.assign({}, { mappings: schemaContent });
    elasticSchema = _.merge(elasticSchema, elasticSchemaExtensions) // user extensions
  }
  return elasticSchema
}

function createIndex (db, indexName, collectionName, next) {
  let indexSchema = collectionName ? loadSchema(collectionName) : loadSchema('index', '5.6'); /** index schema is used only for 5.6 */

  const step2 = () => {
    db.indices.delete({
      'index': indexName
    }).then(res1 => {
      db.indices.create(
        {
          'index': indexName,
          'body': indexSchema
        }).then(res2 => {
        next()
      }).catch(err => {
        console.error(err)
        next(err)
      })
    }).catch(() => {
      db.indices.create(
        {
          'index': indexName,
          'body': indexSchema
        }).then(res2 => {
        next()
      }).catch(err => {
        console.error(err)
        next(err)
      })
    })
  }

  return db.indices.deleteAlias({
    index: '*',
    name: indexName
  }).then((result) => {
    console.log('Public index alias deleted')
    step2()
  }).catch((err) => {
    console.log('Public index alias does not exists', err.message)
    step2()
  })
}

// this is deprecated just for ES 5.6
function putMappings (db, indexName, next) {
  let productSchema = loadSchema('product', '5.6');
  let categorySchema = loadSchema('category', '5.6');
  let taxruleSchema = loadSchema('taxrule', '5.6');
  let attributeSchema = loadSchema('attribute', '5.6');
  let pageSchema = loadSchema('cms_page', '5.6');
  let blockSchema = loadSchema('cms_block', '5.6');

  Promise.all([
    db.indices.putMapping({
      index: indexName,
      type: 'product',
      body: productSchema
    }),
    db.indices.putMapping({
      index: indexName,
      type: 'taxrule',
      body: taxruleSchema
    }),
    db.indices.putMapping({
      index: indexName,
      type: 'attribute',
      body: attributeSchema
    }),
    db.indices.putMapping({
      index: indexName,
      type: 'cms_page',
      body: pageSchema
    }),
    db.indices.putMapping({
      index: indexName,
      type: 'cms_block',
      body: blockSchema
    }),
    db.indices.putMapping({
      index: indexName,
      type: 'category',
      body: categorySchema
    })
  ]).then(values => values.forEach(res => console.dir(res.body, { depth: null, colors: true })))
    .then(next)
    .catch(next)
}

module.exports = {
  putAlias,
  createIndex,
  deleteIndex,
  reIndex,
  search,
  adjustQuery,
  adjustQueryParams,
  adjustBackendProxyUrl,
  getClient,
  getHits,
  getTotals,
  adjustIndexName,
  putMappings
}
