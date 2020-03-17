import config from 'config'

import qs from 'qs'
import { get as http2get } from 'http2-client'
import zlib from 'zlib'

import { objectKeysToCamelCase } from '../helpers/formatter'
import { extractStoryContent, extractPluginValues } from '../helpers/formatter/storyblok'
import { sortBy, pick, merge } from 'lodash'

class StoryblokConnector {
  protected lang

  public api () {
    return {
      get: (endpoint: string = 'cdn/stories', params: Record<string, any>): Promise<any> => {
        const baseUrl = 'https://api.storyblok.com/v1'
        const defaults = {
          token: config.get('extensions.icmaaCms.storyblok.accessToken'),
          // We need a timestamp for SSR cache-invalidation of storyblok
          // https://www.storyblok.com/docs/api/content-delivery#topics/cache-invalidation
          cv: new Date().getTime()
        }

        const querystring: string = '?' + qs.stringify(
          merge(defaults, params),
          { encodeValuesOnly: true, arrayFormat: 'brackets' }
        )

        const headers = {
          'Accept-Encoding': 'gzip, deflate'
        }

        return new Promise((resolve, reject) => {
          let data = ''
          http2get(
            `${baseUrl}/${endpoint}${querystring}`,
            { headers },
            response => {
              // Storyblok is using gzip on its request, so it isn't complete without uncompressing it.
              // The following block minds about the decompression using `zlib` of node.
              // We could do this much simpler using `request`, `axios` or `fetch` but they won't support HTTP2.
              var output
              if (response.headers['content-encoding'] === 'gzip') {
                var gzip = zlib.createGunzip()
                response.pipe(gzip)
                output = gzip
              } else {
                output = response
              }

              output
                .on('error', err => reject(err.message))
                .on('data', chunk => { data += chunk })
                .on('end', () => {
                  if (![200, 201, 301].includes(response.statusCode)) {
                    console.log(JSON.parse(data).error)
                    reject(JSON.parse(data).error)
                  } else {
                    resolve(JSON.parse(data))
                  }
                })
            })
        })
      }
    }
  }

  public matchLanguage (lang) {
    lang = lang && lang !== 'default' ? lang.toLowerCase() : false
    this.lang = lang && config.get('icmaa.mandant') ? `${config.get('icmaa.mandant')}_${lang}` : lang
    return this.lang
  }

  public isJsonString (string) {
    try {
      return JSON.parse(string)
    } catch (e) {
      return false
    }
  }

  public async fetch ({ type, uid, lang, key }) {
    try {
      let request: Promise<any>
      const fetchById = (key && key === 'id')

      this.matchLanguage(lang)

      if (!fetchById) {
        request = this.api().get('cdn/stories', {
          'starts_with': this.lang ? `${this.lang}/*` : '',
          'filter_query': {
            'component': { 'in': type },
            [key || 'identifier']: { 'in': uid }
          }
        })
      } else {
        request = this.api().get(
          `cdn/stories/${uid}`,
          { language: this.lang ? this.lang : undefined }
        )
      }

      return request
        .then(response => {
          const story = fetchById
            ? response.story || {}
            : response.stories.shift() || {}
          const content = extractStoryContent(story)
          objectKeysToCamelCase(content)
          extractPluginValues(content)
          return content
        }).catch(() => {
          return { }
        })
    } catch (error) {
      return error
    }
  }

  public async search ({ type, q, lang, fields }) {
    let queryObject = { 'identifier': { 'in': q } }
    if (this.isJsonString(q)) {
      queryObject = this.isJsonString(q)
    }

    try {
      this.matchLanguage(lang)
      return this.searchRequest({ queryObject, type, page: 1, fields })
    } catch (error) {
      return error
    }
  }

  public async searchRequest ({ queryObject, type, page = 1, results = [], fields }) {
    return this.api().get('cdn/stories', {
      'page': page,
      'per_page': 100,
      'starts_with': this.lang ? `${this.lang}/*` : '',
      'filter_query': {
        'component': { 'in': type },
        ...queryObject
      }
    }).then(response => {
      let stories = response.stories
        .map(story => extractStoryContent(story))
        .map(story => objectKeysToCamelCase(story))
        .map(story => extractPluginValues(story))

      if (fields && fields.length > 0) {
        stories = stories.map(story => pick(story, fields.split(',')))
      }

      results = [].concat(results, stories)
      if (stories.length < 100) {
        return results
      }

      return this.searchRequest({ queryObject, type, page: page + 1, results, fields })
    }).catch(() => {
      return []
    })
  }

  public createAttributeOptionArray (options, nameKey: string|Function = 'label', valueKey: string = 'value', sortKey: string|boolean = 'sort_order') {
    let result = []
    options.forEach(option => {
      result.push({
        'name': typeof nameKey === 'function' ? nameKey(option) : option[nameKey],
        'value': option[valueKey],
        'sort_order': sortKey !== false ? option[sortKey as string] : 1
      })
    })

    result = sortBy(result, ['sort_order', 'name'])

    return result
  }

  public async datasource ({ code, page = 1 }) {
    try {
      return this.api().get('cdn/datasource_entries', {
        datasource: code,
        'page': page,
        'per_page': 1000
      }).then(response => {
        return response.datasource_entries.map(e => ({ value: e.value, label: e.name }))
      }).catch(() => {
        return []
      })
    } catch (error) {
      return error
    }
  }
}

export default new StoryblokConnector()
