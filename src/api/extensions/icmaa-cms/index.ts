import { apiStatus } from '../../../lib/util'
import { sha3_224 } from 'js-sha3'
import { Router } from 'express'

import storyblokConnector from './connector/storyblok'
import { cacheResult, cacheHandler } from './connector/cache'
import { getClient as esClient } from '../../../lib/elastic'

module.exports = ({ config, db }) => {
  let api = Router()

  api.get('/by-uid', async (req, res) => {
    const { url, query } = req
    const { type, uid, lang } = query
    if (type === undefined || uid === undefined) {
      return apiStatus(res, '"uid" and "type" are mandatory in request url', 500)
    }

    const reqHash = sha3_224(url)
    const cacheTags = ['CMS', `CMS-${type}`.toUpperCase(), `CMS-${type}-${uid}`.toUpperCase()]

    const cachedResult = await cacheHandler(config, res, reqHash)
    if (!cachedResult) {
      console.log(`Cache miss [${url}]`)
    } else {
      console.log(`Cache hit [${url}]`)
      return
    }

    let serviceName = config.extensions.icmaaCms.service;
    switch (serviceName) {
      case 'storyblok':
        await storyblokConnector.fetch({ type, uid, lang })
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
    let cacheTags = ['CMS', `CMS-${type}`.toUpperCase()]

    const cachedResult = await cacheHandler(config, res, reqHash)
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

  api.get('/attribute/:code', async (req, res) => {
    return esClient(config).search({
      index: config.elasticsearch.indices[0],
      type: 'attribute',
      body: {
        '_source': ['attribute_code', 'id', 'options', 'frontend_label'],
        'query': {
          'term': {
            'attribute_code': {
              'value': req.params.code
            }
          }
        }
      }
    }).then(response => {
      const { body } = response
      if (body.hits.total === 0) {
        return apiStatus(res, 'No attribute found', 400)
      }

      const result = body.hits.hits[0]._source
      if (result && result.options) {
        switch (req.query.style) {
          case 'storyblok':
            return res.status(200).json(
              storyblokConnector.createAttributeOptionArray(result.options)
            )
          default:
            return apiStatus(res, result.options, 200)
        }
      }

      return apiStatus(res, 'No attribute values found', 400)
    }).catch(e => apiStatus(res, 'Elasticsearch client: ' + e.message, 500))
  })

  api.get('/categories', async (req, res) => {
    return esClient(config).search({
      index: config.elasticsearch.indices[0],
      type: 'category',
      size: 5000,
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
      if (body.hits.total === 0) {
        return apiStatus(res, 'No categories found', 400)
      }

      if (body.hits.hits) {
        let results = []
        body.hits.hits.forEach(category => {
          results.push(category._source)
        })

        switch (req.query.style) {
          case 'storyblok':
            return res.status(200).json(
              storyblokConnector.createAttributeOptionArray(
                results,
                c => `${c.name} (/${c.url_path})`,
                'slug',
                false
              )
            )
          default:
            return apiStatus(res, results, 200)
        }
      }

      return apiStatus(res, 'No categories found', 400)
    }).catch(e => apiStatus(res, 'Elasticsearch client: ' + e.message, 500))
  })

  return api
}
