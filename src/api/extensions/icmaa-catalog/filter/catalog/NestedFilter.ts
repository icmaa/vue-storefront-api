import config from 'config'
import { FilterInterface } from 'storefront-query-builder'

/**
 * As we map the `configurable_children` attribute as nested to be able to do proper searching,
 * we need to change the way how nested queries are build. We can't just use dot notated terms like
 * `configurable_children.sku` in a term query/filter – we need to use a `nested` query.
 * Otherwise VSF won't e.g. be able to find parent products by child SKU as in `findProductOption`
 * method of the cart module – which loads server-cart-items into the customers cart.
 */

const nestedPrefixPaths = config.get<string[]>('extensions.icmaa-catalog.nestedFilterAttributePrefixes')

const getLastAttributePathItem = (attribute: string): string => attribute.split('.').slice(-1).pop()

const isKeywordAttribute = (attribute: string): boolean => {
  const keywordAttributes = ['sku', 'name', 'image', 'small_image']
  return keywordAttributes.includes(getLastAttributePathItem(attribute))
}

const filter: FilterInterface = {
  priority: 1,
  check: ({ attribute }) => nestedPrefixPaths.some(a => attribute.startsWith(a)),
  filter ({ queryChain, value, attribute, operator }) {
    queryChain.query('nested', { path: 'configurable_children' }, confChildQuery => {
      confChildQuery.query('bool', childBoolWrapper => {
        let filters: FilterInterface[] = Object.values(this.baseFilters)
        for (let filterHandler of filters) {
          const { queryChain } = this
          if (filterHandler.check({ operator, attribute, value, queryChain })) {
            value = filterHandler.hasOwnProperty('mutator') ? filterHandler.mutator(value) : value
            const filterParams = {
              operator,
              attribute: isKeywordAttribute(attribute) ? attribute + '.keyword' : attribute,
              value,
              queryChain: childBoolWrapper
            }
            childBoolWrapper = filterHandler.filter.call(this, filterParams)
            break
          }
        }

        return childBoolWrapper
      })

      return confChildQuery
    })

    return queryChain
  }
}

export default filter
