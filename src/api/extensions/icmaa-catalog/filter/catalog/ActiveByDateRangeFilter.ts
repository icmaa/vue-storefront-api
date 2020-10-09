import config from 'config'
import { FilterInterface } from 'storefront-query-builder'
import omit from 'lodash/omit'

interface FilterDefaults { from: string, to: string, utcOffset: string }
const defaultFields = config.get<FilterDefaults>('extensions.icmaa-catalog.defaultDateRangeFields')

const filter: FilterInterface = {
  priority: 1,
  check: ({ attribute }) => attribute === 'activeDateRange',
  filter ({ queryChain, value }) {
    // Empty values populated as `{ "in": "" }` – this would crash our query.
    if (Object.keys(value).length === 1 && value.hasOwnProperty('in')) {
      value = {}
    }

    const dateTime = value.dateTime || defaultFields.utcOffset
    const fromField = value.fromField || defaultFields.from
    const toField = value.toField || defaultFields.to

    value = omit(value, ['dateTime', 'fromField', 'toField'])

    queryChain.filter('bool', rangeQuery => {
      rangeQuery
        // From
        .filter('bool', rangeFromQuery => {
          return rangeFromQuery
            .orFilter('bool', rangeFromEmptyQuery => {
              return rangeFromEmptyQuery.notFilter('exists', fromField)
            })
            .orFilter('range', fromField, {
              ...Object.assign({}, { 'lte': dateTime }, value)
            })
        })
        // To
        .filter('bool', rangeToQuery => {
          return rangeToQuery
            .orFilter('bool', rangeToEmptyQuery => {
              return rangeToEmptyQuery.notFilter('exists', toField)
            })
            .orFilter('range', toField, {
              ...Object.assign({}, { 'gte': dateTime }, value)
            })
        })

      return rangeQuery
    })

    return queryChain
  }
}

export default filter
