import config from 'config'
import { FilterInterface } from 'storefront-query-builder'

const filter: FilterInterface = {
  priority: 1,
  check: ({ attribute }) => attribute === 'stock' || config.get<any[]>('products.configurable_options').includes(attribute),
  filter ({ queryChain }) {
    const hasStockFilter = this.appliedFilters.some(({ attribute }) => attribute === 'stock')

    const confOptions = this.config.products.configurable_options
    const confOptionsFilters = this.appliedFilters.filter(({ attribute }) => confOptions.includes(attribute))
    const hasConfOptions = confOptionsFilters.length > 0

    // nest the stock and configurable filter into own "bool" clause to make them not collide with other or clauses
    queryChain.filter('bool', nestedQuery => {
      nestedQuery.filterMinimumShouldMatch(1)

      // configurable products
      nestedQuery.orFilter('bool', confQuery => {
        if (hasStockFilter) {
          confQuery.filter('term', 'stock.is_in_stock', true)
        }

        let confChildQuery = this.bodybuilder()
        if (hasConfOptions) {
          confOptionsFilters.forEach(f => {
            const filter = {
              attribute: 'configurable_children.' + f.attribute,
              value: f.value,
              scope: f.scope
            }
            confChildQuery = this.catalogFilterBuilder(confChildQuery, filter, undefined, 'query')
          })
        }

        if (hasStockFilter) {
          confChildQuery
            .query('nested', { path: 'configurable_children.stock' }, confChildStockQuery =>
              confChildStockQuery
                .query('term', 'configurable_children.stock.is_in_stock', true)
                .query('range', 'configurable_children.stock.qty', { 'gt': 0 })
            )
        }

        return confQuery
          .filter('nested', { path: 'configurable_children', ...confChildQuery.build() })
      })

      // simple products
      nestedQuery.orFilter('bool', smplQuery => {
        if (hasConfOptions) {
          confOptionsFilters.forEach(f => {
            smplQuery = this.catalogFilterBuilder(smplQuery, f, this.optionsSuffix)
          })
        }

        if (hasStockFilter) {
          smplQuery
            .filter('term', 'stock.is_in_stock', true)
            .filter('range', 'stock.qty', { 'gt': 0 })
        }

        return smplQuery
          .notFilter('term', 'type_id', 'configurable')
      })

      return nestedQuery
    })

    // Remove already applied stock filters
    this.appliedFilters = this.appliedFilters.filter(f => f.attribute !== 'stock' && !confOptions.includes(f.attribute))

    return queryChain
  }
}

export default filter
