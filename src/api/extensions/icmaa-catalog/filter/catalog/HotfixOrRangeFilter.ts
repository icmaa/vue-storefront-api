import { FilterInterface } from 'storefront-query-builder'
import { extractFirstValueMutator } from './HotfixOrFilter'

const rangeOperators = ['gt', 'lt', 'gte', 'lte', 'moreq', 'from', 'to']
const orRangeOperators = rangeOperators.map(o => 'or' + o.charAt(0).toUpperCase() + o.substr(1))

const filter: FilterInterface = {
  priority: 1,
  check: ({ value }) => Object.keys(value).every(o => orRangeOperators.includes(o)),
  filter: ({ attribute, value, queryChain }) => {
    queryChain.filterMinimumShouldMatch(1, true)
    for (let o in value) {
      const realOperator = o.substr(2).toLowerCase()
      value[realOperator] = value[o]
      delete value[o]
    }
    return queryChain.orFilter('range', attribute, value)
  },
  mutator: extractFirstValueMutator
}

export default filter
