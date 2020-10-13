import { FilterInterface } from 'storefront-query-builder'

export const extractFirstValueMutator = (value): any[] => {
  value = value[Object.keys(value)[0]]
  if (!Array.isArray(value) && value !== null) {
    value = [value]
  }
  return value
}

const filter: FilterInterface = {
  priority: 1,
  check: ({ operator }) => operator === 'or',
  filter: ({ value, attribute, queryChain }) => {
    queryChain.filterMinimumShouldMatch(1, true)
    if (value === null) {
      return queryChain.orFilter('bool', b => {
        return b.notFilter('exists', attribute)
      })
    } else {
      return queryChain.orFilter('terms', attribute, value)
    }
  },
  mutator: extractFirstValueMutator
}

export default filter
