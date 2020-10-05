import config from 'config'
import { FilterInterface } from 'storefront-query-builder'
import omit from 'lodash/omit'

const defaultFields = config.get<{ from: string, to: string }>('extensions.icmaa-catalog.defaultDateRangeFields')

const filter: FilterInterface = {
  priority: 1,
  check: ({ attribute }) => attribute === 'activeDateRange',
  filter ({ queryChain, value }) {
    // Empty values populated as `{ "in": "" }` – this would crash our query.
    if (Object.keys(value).length === 1 && value.hasOwnProperty('in')) {
      value = {}
    }

    const fromField = value.fromField || defaultFields.from
    const toField = value.toField || defaultFields.to

    value = omit(value, ['fromField', 'toField'])

    queryChain.filter('bool', rangeQuery => {
      rangeQuery
        // From
        .filter('bool', rangeFromQuery => {
          return rangeFromQuery
            .orFilter('bool', rangeFromEmptyQuery => {
              return rangeFromEmptyQuery.notFilter('exists', fromField)
            })
            .orFilter('range', fromField, {
              ...Object.assign({}, { 'lte': 'now' }, value)
            })
        })
        // To
        .filter('bool', rangeToQuery => {
          return rangeToQuery
            .orFilter('bool', rangeToEmptyQuery => {
              return rangeToEmptyQuery.notFilter('exists', toField)
            })
            .orFilter('range', toField, {
              ...Object.assign({}, { 'gte': 'now' }, value)
            })
        })

      return rangeQuery
    })

    return queryChain
  }
}

export default filter
