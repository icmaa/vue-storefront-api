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

## API endpoints
```
// None
```
