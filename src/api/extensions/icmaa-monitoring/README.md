# ICMAA - Monitoring extension

This module includes a request logging middleware using `winson` and `express-winston` to be able to log each request in JSON format.

## Configuration

1. Copy the following line under the default `morgan` logging middleware in `src/index.ts`:
   ```javascript
   app.use(require('icmaa-monitoring')({ config }))
   ```
2. Import the Datadog tracer in `src/index.ts` like:
   ```javascript
   import 'icmaa-monitoring/datadog/dd-trace'
   ```
3. Add configs to `local.json`:
   ```
   "icmaa_monitoring": {
      "datadog": {
        "enabled": true,
        "clientToken": "XXX"
      }
    }
   ```
