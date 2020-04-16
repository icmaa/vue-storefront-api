# ICMAA - User

This API extension add Magento1 actions for a custom `vsf-bridge` endpoint in Magento.

## Configuration

1. In your `local.json` file you should register the extension like:
   `"registeredExtensions": ["icmaa-user", …],`
2. Add endpoints to VSF in `local.json`:
   ```
   "users": {
     "last_order": "/api/ext/icmaa-user/last-order?token={{token}}"
   }
   ```

## API endpoints
```
/api/ext/icmaa-user/last-order
```
