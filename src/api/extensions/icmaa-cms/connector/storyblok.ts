import config from 'config'

import qs from 'qs'
import fetch from 'node-fetch'
import cache from '../../../../lib/cache-instance'

import { objectKeysToCamelCase } from '../helpers/formatter'
import { extractStoryContent, extractPluginValues } from '../helpers/formatter/storyblok'
import { sortBy, pick, merge } from 'lodash'

interface CreateAttributeOptionArrayParams {
  options: any[],
  nameKey?: string|Function,
  valueKey?: string,
  sortKey?: string
}

class StoryblokConnector {
  protected lang

  public api () {
    return {
      get: async (endpoint: string = 'cdn/stories', params: Record<string, any> = {}, cv?: string): Promise<any> => {
        const baseUrl = 'https://api.storyblok.com/v1'
        const defaults = {
          token: config.get('extensions.icmaaCms.storyblok.accessToken'),
          // Storyblok needs a cache-version or will alwys serve uncached versions which leads to hit the limit quickly.
          // @see https://www.storyblok.com/docs/api/content-delivery#topics/cache-invalidation
          cv: cv || await this.api().cv()
        }

        const querystring: string = '?' + qs.stringify(
          merge(defaults, params),
          { encodeValuesOnly: true, arrayFormat: 'brackets' }
        )

        return fetch(`${baseUrl}/${endpoint}${querystring}`)
          .then(async (response) => {
            const data = await response.json()
            if (response.status !== 401) {
              return data
            }
            throw Error(data.error)
          })
          .catch(error => {
            console.error('Error during storyblok fetch:', error)
            return {}
          })
      },
      cv: async (): Promise<string> => {
        const cacheKey = 'storyblokCacheVersion'
        if (!config.get('server.useOutputCache') || !cache || !cache.hasOwnProperty('get')) {
          return Date.now().toString()
        }

        return cache.get(cacheKey).then(output => {
          if (output !== null) {
            return output.toString()
          }
          return this.api()
            .get('cdn/spaces/me', {}, 'justnow')
            .then(resp => {
              const cv = resp.space.version.toString()
              return cache.set(cacheKey, cv, ['cms', `cms-cacheversion`])
                .then(() => cv)
            })
        }).catch(e => {
          console.error('Error during storyblok CV fetch:', e)
          return Date.now().toString()
        })
      }
    }
  }

  public matchLanguage (lang) {
    const defaultLanguageCodes: string[] = config.get('extensions.icmaaCms.storyblok.defaultLanguageCodes')
    lang = lang && !defaultLanguageCodes.includes(lang) ? lang.toLowerCase() : false
    this.lang = lang && config.get('icmaa.mandant') ? `${config.get('icmaa.mandant')}_${lang}` : lang
    return this.lang
  }

  public isJsonString (string) {
    try {
      let query = JSON.parse(string)
      for (const key in query) {
        if (key.startsWith('i18n_')) {
          query['__or'] = [
            { [this.getKey(key)]: query[key] },
            { [key.slice(5)]: query[key] }
          ]

          delete query[key]
        }
      }

      return query
    } catch (e) {
      return false
    }
  }

  public getKey (key: string = 'identifier'): string {
    return (key.startsWith('i18n_')) ? key.slice(5) + '__i18n__' + this.lang : key
  }

  public async fetch ({ type, uid, lang, key }) {
    try {
      let request: Promise<any>
      const fetchById = (key && key === 'id')

      this.matchLanguage(lang)

      if (!fetchById) {
        let query: any = { [this.getKey(key)]: { 'in': uid } }
        if (key && key.startsWith('i18n_')) {
          query = {
            '__or': [
              { [this.getKey(key)]: { 'in': uid } },
              { [key.slice(5)]: { 'in': uid } }
            ]
          }
        }

        request = this.api().get('cdn/stories', {
          'starts_with': this.lang ? `${this.lang}/*` : '',
          'filter_query_v2': {
            'component': { 'in': type },
            ...query
          }
        })
      } else {
        request = this.api().get(
          `cdn/stories/${uid}`,
          { language: this.lang ? this.lang : undefined }
        )
      }

      return request
        .then(async response => {
          const story = fetchById
            ? response.story || {}
            : response.stories.shift() || {}
          const content = extractStoryContent(story)
          objectKeysToCamelCase(content)
          await extractPluginValues(content).catch(e => {
            console.error('Error during plugin value mapping:', e)
          })
          return content
        }).catch(e => {
          console.error('Error during parsing:', e)
          return { }
        })
    } catch (error) {
      throw error
    }
  }

  public async search ({ type, q, lang, fields }) {
    this.matchLanguage(lang)

    let queryObject: any = { 'identifier': { 'in': q } }
    const jsonQuery: any = this.isJsonString(q)
    if (jsonQuery) {
      queryObject = jsonQuery
    }

    try {
      return this.searchRequest({ queryObject, type, page: 1, fields })
    } catch (error) {
      throw error
    }
  }

  public async searchRequest ({ queryObject, type, page = 1, results = [], fields }) {
    return this.api().get('cdn/stories', {
      'page': page,
      'per_page': 25,
      'starts_with': this.lang ? `${this.lang}/*` : '',
      'filter_query_v2': {
        'component': { 'in': type },
        ...queryObject
      }
    }).then(async response => {
      let stories = response.stories
        .map(story => extractStoryContent(story))
        .map(story => objectKeysToCamelCase(story))

      stories = await Promise.all(
        stories.map(story => extractPluginValues(story))
      ).catch(e => {
        console.error('Error during plugin value mapping:', e)
      })

      if (fields && fields.length > 0) {
        stories = stories.map(story => pick(story, fields.split(',')))
      }

      results = [].concat(results, stories)
      if (stories.length < 25) {
        return results
      }

      return this.searchRequest({ queryObject, type, page: page + 1, results, fields })
    }).catch(e => {
      console.error('Error during parsing:', e)
      return []
    })
  }

  public createAttributeOptionArray ({ options, nameKey = 'label', valueKey = 'value', sortKey }: CreateAttributeOptionArrayParams) {
    let result = []
    options.forEach(option => {
      result.push({
        'name': typeof nameKey === 'function' ? nameKey(option) : option[nameKey],
        'value': option[valueKey],
        'sort_order': sortKey ? option[sortKey as string] : 1
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
