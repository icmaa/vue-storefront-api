# ICMAA - Catalog API extension

This API extension adds support for custom filters of `storefront-query-builder`.

## Custom filters

This is the list of custom filters we use:

* StockFilter - `filter/catalog/StockFilter.ts`
  * This adds a stock filter for all products, also configurable ones, and filter its configruable options for availabillity.
* SearchTextQuery - `filter/catalog/SearchTextQuery.ts`
  * We have a slightly different mapping of fields than the default store, that is why we need to make a bit different `_searchText` query for free-text-searching. Our `category` property is mapped as `nested` object and therefore wouldn't support the default `multimatch` query using `category.name` as field. In our case the `multimatch` query condition has to be wrapped inside a `nested` condition. As we can't overwrite the `applyTextQuery()` method of `storefront-query-builder` out-of-the-box, we created a custom-filter which uses the same routing as `applyTextQuery()` but adds the changes we need. So, the query must be changed as well in `vue-storefront` search-routine into `.applyFilter({ key: 'search-text', value: 'Search string ...' })`.

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

## API endpoints
```
// None
```
