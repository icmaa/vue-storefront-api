import { FilterInterface } from 'storefront-query-builder'
import getMultiMatchConfig from 'storefront-query-builder/lib/elasticsearch/multimatch'
import getBoosts from 'storefront-query-builder/lib/elasticsearch/boost'
import getFunctionScores from 'storefront-query-builder/lib/elasticsearch/score'

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

    let searchableFields = []
    let searchableAttributes = this.config.elasticsearch.hasOwnProperty('searchableAttributes')
      ? this.config.elasticsearch.searchableAttributes : { 'name': { 'boost': 1 } }
    for (const attribute of Object.keys(searchableAttributes)) {
      searchableFields.push(attribute + '^' + getBoosts(this.config, attribute))
    }

    const newQueryChain = this.bodybuilder()
      .orQuery('nested', { path: 'category' }, b => b.query('multi_match', 'fields', searchableFields, getMultiMatchConfig(this.config, value)))
      .orQuery('bool', b => b.orQuery('terms', 'configurable_children.sku', value.split('-'))
        .orQuery('match_phrase', 'sku', { query: value, boost: 1 })
        .orQuery('match_phrase', 'configurable_children.sku', { query: value, boost: 1 })
      )

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
