import { FilterInterface } from 'storefront-query-builder'
import { forEach, pick, omit } from 'lodash'
import getMultiMatchConfig from 'storefront-query-builder/lib/elasticsearch/multimatch'
import getFunctionScores from 'storefront-query-builder/lib/elasticsearch/score'

interface MultiMatchItem {
  operator: 'or'|'and',
  [key: string]: { boost: number } | MultiMatchItem | any
}

const multiMatchConfigFields = ['operator', 'fuzziness', 'cutoff_frequency', 'max_expansions',
  'prefix_length', 'minimum_should_match', 'tie_breaker', 'analyzer']

const getMultimatchQuery = (queryChain: any, fields: MultiMatchItem, multiMatchConfig: any, nestedPath?: string): any => {
  nestedPath = nestedPath ? nestedPath + '.' : ''
  let readyFields = []
  forEach(fields, (value, path) => {
    if (value.hasOwnProperty('boost')) {
      readyFields.push(nestedPath + path + '^' + value['boost'])
    } else {
      const nestedMultiMatchConfig = Object.assign({}, multiMatchConfig, pick(fields[path], multiMatchConfigFields))
      queryChain.orQuery('nested', { path: nestedPath + path }, nestedQueryChain =>
        getMultimatchQuery(nestedQueryChain, omit(fields[path], multiMatchConfigFields), nestedMultiMatchConfig, nestedPath + path)
      )
    }
  })

  if (readyFields.length > 0) {
    queryChain.orQuery('multi_match', 'fields', readyFields, multiMatchConfig)
  }

  return queryChain
}

const filter: FilterInterface = {
  priority: 1,
  check: ({ attribute }) => ['search-text', 'search-text-plain'].includes(attribute),
  filter ({ queryChain, value, attribute }) {
    /**
     * This is a modified copy of the `applyTextQuery()` method in `storefront-query-builder/src/elasticsearch/body.ts`.
     * We added support for mutlimatch the nested category property. See `README.md` for more info.
     */

    if (value === '' || !value) {
      return queryChain
    }

    let newQueryChain = this.bodybuilder()

    let searchableAttributes: MultiMatchItem = this.config.elasticsearch.hasOwnProperty('searchableAttributes')
      ? this.config.elasticsearch.searchableAttributes : { 'name': { 'boost': 1 } }

    const multiMatchConfig = getMultiMatchConfig(this.config, value)
    newQueryChain = getMultimatchQuery(newQueryChain, searchableAttributes, multiMatchConfig)

    newQueryChain.orQuery('match_phrase', 'sku', { query: value, boost: 1 })

    let functionScore = getFunctionScores(this.config)
    if (functionScore) {
      this.queryChain.query('function_score', functionScore, () => newQueryChain)
    } else {
      this.queryChain.query('bool', newQueryChain)
    }

    // Add category-aggregation using `nested` and `top-hits` to get all possible categories in results for category filter
    // And sort them by their max score first and then by documents found with this category
    if (!attribute.endsWith('plain')) {
      this.queryChain.agg('nested', { path: 'category' }, 'categories_found', b => {
        const options = { size: 50, order: [ { 'max_score': 'desc' }, { '_count': 'desc' } ] }
        return b.agg('terms', 'category.category_id', options, 'categories', c => {
          return c.agg('max', { script: '_score' }, 'max_score')
            .agg('top_hits', { _source: [ 'category.name', 'category.category_id', 'category.position' ], size: 1 }, 'hits')
        })
      })
    }

    return this.queryChain
  },
  mutator: (value) => Object.values(value)[0][0]
}

export default filter
