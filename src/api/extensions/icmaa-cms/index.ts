import { apiStatus } from '../../../lib/util'
import { sha3_224 } from 'js-sha3'
import { Router } from 'express'

import storyblokConnector from './connector/storyblok'
import { cacheResult, cacheHandler } from './connector/cache'
import { getClient as esClient, adjustQueryParams, adjustQuery, getTotals, getHits } from '../../../lib/elastic'

module.exports = ({ config }) => {
  let api = Router()

  api.get('/by-uid', async (req, res) => {
    const { url, query } = req
    const { type, uid, lang, key } = query
    if (type === undefined || uid === undefined) {
      return apiStatus(res, '"uid" and "type" are mandatory in request url', 500)
    }

    const reqHash = sha3_224(url)
    const cacheTags = ['cms', `cms-${type}`, `cms-${type}-${uid}`]

    const cachedResult = await cacheHandler(config, res, reqHash, req)
    if (!cachedResult) {
      console.log(`Cache miss [${url}]`)
    } else {
      console.log(`Cache hit [${url}]`)
      return
    }

    let serviceName = config.extensions.icmaaCms.service;
    switch (serviceName) {
      case 'storyblok':
        await storyblokConnector.fetch({ type, uid, lang, key })
          .then(response => {
            cacheResult(config, response, reqHash, cacheTags)
            return apiStatus(res, response, 200)
          })
          .catch(error => apiStatus(res, error.message, 500))
        break
      default:
        return apiStatus(res, `CMS service "${serviceName}" is not supported yet`, 500)
    }
  })

  api.get('/search', async (req, res) => {
    const { url, query } = req
    const { type, q, lang, fields } = query
    if (type === undefined || q === undefined) {
      return apiStatus(res, '"q" and "type" are mandatory in request url', 500)
    }

    const reqHash = sha3_224(url)
    let cacheTags = ['cms', `cms-${type}`]

    const cachedResult = await cacheHandler(config, res, reqHash, req)
    if (!cachedResult) {
      console.log(`Cache miss [${url}]`)
    } else {
      console.log(`Cache hit [${url}]`)
      return
    }

    let serviceName = config.extensions.icmaaCms.service;
    switch (serviceName) {
      case 'storyblok':
        await storyblokConnector.search({ type, q, lang, fields })
          .then(response => {
            cacheResult(config, response, reqHash, cacheTags)
            return apiStatus(res, response, 200)
          })
          .catch(error => apiStatus(res, error.message, 500))
        break
      default:
        return apiStatus(res, `CMS service "${serviceName}" is not supported yet`, 500)
    }
  })

  api.get('/attribute/:codes', async (req, res) => {
    const query = adjustQuery({
      index: config.elasticsearch.indices[0],
      method: req.method
    }, 'attribute', config)

    return esClient(config).search({
      ...query,
      body: {
        '_source': ['attribute_code', 'id', 'options', 'frontend_label'],
        'query': {
          'terms': {
            'attribute_code': req.params.codes.split(',')
          }
        }
      }
    }).then(response => {
      const { body } = response
      if (getTotals(body) === 0) {
        return apiStatus(res, 'No attribute found', 400)
      }

      const options = getHits(response)
        .reduce((a, b) => a.concat(b._source.options || []), [])

      if (options) {
        switch (req.query.style) {
          case 'storyblok':
            const { nameKey, valueKey, sortKey } = req.query
            return res.status(200).json(
              storyblokConnector.createAttributeOptionArray({
                options,
                nameKey: (nameKey as string),
                valueKey: (valueKey as string),
                sortKey: (sortKey as string)
              })
            )
          default:
            return apiStatus(res, options, 200)
        }
      }

      return apiStatus(res, 'No attribute values found', 400)
    }).catch(e => apiStatus(res, 'Elasticsearch client: ' + e.message, 500))
  })

  api.get('/categories', async (req, res) => {
    const query = adjustQuery({
      index: config.elasticsearch.indices[0],
      size: 5000
    }, 'category', config)

    return esClient(config).search({
      ...query,
      body: {
        '_source': ['id', 'url_path', 'slug', 'name'],
        'query': {
          'bool': {
            'must': [
              { 'exists': { 'field': 'name' } },
              { 'exists': { 'field': 'slug' } }
            ]
          }
        }
      }
    }).then(response => {
      const { body } = response
      if (getTotals(body) === 0) {
        return apiStatus(res, 'No categories found', 400)
      }

      const hits = getHits(response)
      if (hits) {
        let options = []
        hits.forEach(category => {
          options.push(category._source)
        })

        switch (req.query.style) {
          case 'storyblok':
            return res.status(200).json(
              storyblokConnector.createAttributeOptionArray({
                options,
                nameKey: c => `${c.name} (/${c.url_path})`,
                valueKey: 'slug'
              })
            )
          default:
            return apiStatus(res, options, 200)
        }
      }

      return apiStatus(res, 'No categories found', 400)
    }).catch(e => apiStatus(res, 'Elasticsearch client: ' + e.message, 500))
  })

  api.get('/datasource/:code', async (req, res) => {
    const { url, params } = req
    const { code } = params
    if (code === undefined) {
      return apiStatus(res, '"Code" is mandatory in request url', 500)
    }

    const reqHash = sha3_224(url)
    const cacheTags = ['cms', `cms-datasource`, `cms-datasource-${code}`]

    const cachedResult = await cacheHandler(config, res, reqHash, req)
    if (!cachedResult) {
      console.log(`Cache miss [${url}]`)
    } else {
      console.log(`Cache hit [${url}]`)
      return
    }

    let serviceName = config.extensions.icmaaCms.service;
    switch (serviceName) {
      case 'storyblok':
        await storyblokConnector.datasource({ code })
          .then(response => {
            cacheResult(config, response, reqHash, cacheTags)
            return apiStatus(res, response, 200)
          })
          .catch(error => apiStatus(res, error.message, 500))
        break
      default:
        return apiStatus(res, `CMS service "${serviceName}" is not supported yet`, 500)
    }
  })

  api.get('/edit/:id', async (req, res) => {
    const { id } = req.params
    if (id === undefined) {
      return apiStatus(res, '"id" is mandatory in request url', 500)
    }

    let serviceName = config.extensions.icmaaCms.service;
    switch (serviceName) {
      case 'storyblok':
        const { spaceId } = config.extensions.icmaaCms.storyblok
        return res
          .status(301)
          .redirect(`https://app.storyblok.com/#!/me/spaces/${spaceId}/stories/0/0/${id}`)
      default:
        return apiStatus(res, `CMS service "${serviceName}" is not supported yet`, 500)
    }
  })

  return api
}
