# ICMAA - Monitoring extension

This module includes a request logging middleware using `winson` and `express-winston` to be able to log each request in JSON format.

## Configuration

1. Copy the following line under the default `morgan` logging middleware in `src/index.ts`:
   ```javascript
   app.use(require('icmaa-monitoring')({ config }));
   ```
2. Import the Datadog tracer in `src/index.ts` like:
   ```javascript
   import 'icmaa-monitoring/build/datadog/dd-trace'
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

## Troubleshooting

### Use submodule packages in core files

As we include this scripts into core files, we need to compile them first. Therefore we have a seperate build script which compiles our TypeScript code using `tsc`. We could just include relative module paths but this won't work if `yarn` puts workspace deps into the module folder (it does this if necessary, eg. for version conflicts between multiple packages). Thats why we need to seperatly compile our sub-package into parsed JS files inside its module folder so we can import it by it's namespace and NodeJS knows where to get the modules from if they are in the modules `/node_modules` folder.

As we don't have something like `lerna` right now (to handle builds of custom submodules), we need to do this on our own using a modules build script like `yarn workspace icmaa-monitoring build` if code changes and commit this code into `git` then. This is a workaround as we don't have any other use-cases with this problems. **We should change this and use `lerna` to automatically build submodules.**
