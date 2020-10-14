import { FilterInterface } from 'storefront-query-builder'
import { extractFirstValueMutator } from './HotfixOrFilter'

const filter: FilterInterface = {
  priority: 1,
  check: ({ operator }) => operator === 'nor',
  filter: ({ value, attribute, queryChain }) => {
    queryChain.filterMinimumShouldMatch(1, true)
    if (value === null) {
      return queryChain.orFilter('exists', attribute)
    } else {
      return queryChain.orFilter('bool', b => {
        return b.notFilter('terms', attribute, value)
      })
    }
  },
  mutator: extractFirstValueMutator
}

export default filter
