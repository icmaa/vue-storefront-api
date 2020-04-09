# ICMAA - Catalog API extension

This API extension adds support for custom filters of `storefront-query-builder`.

## Custom filters

This is the list of custom filters we use:

* StockFilter - `filter/catalog/StockFilter.ts`
  * This adds a stock filter for all products, also configurable ones, and filter its configruable options for availabillity.

## Configuration

1. In your `local.json` file you should register the extension like:
   `"registeredExtensions": ["icmaa-catalog", …],`
1. Add our custom filter to the extensions setting to let `vue-storefront-api` know that it exists
   ```
   {
      "registeredExtensions": [ "icmaa-catalog", … ],
      "extensions: {
         "icmaa-catalog": {
            "catalogFilter": [ "StockFilter" ]
         }
      }
   }
1. Add our import helper to `src/api/catalog.ts` like
   ```
   import loadCustomFilters from './extensions/icmaa-catalog/helpers/loadCustomFilters'
   ```
1. And at the line where the `search-query` type is generated, add our `loadCustomFilters` method:
   ```js
   if (req.query.request_format === 'search-query') { // search query and not Elastic DSL - we need to translate it
     const customFilters = await loadCustomFilters(config)
     requestBody = await elasticsearch.buildQueryBodyFromSearchQuery({ config, queryChain: bodybuilder(), searchQuery: new SearchQuery(requestBody), customFilters })
   }
   ´´´

> The last two points are obsolete once this feature is offically included in the `vue-storefront-api` (PR is already open).

## API endpoints
```
// None
```
