import config from 'config'
import tracer from 'dd-trace'

if (config.get('extensions.icmaa-monitoring.datadog.enabled') === true) {
  tracer.init({
    service: 'vue-storefront-api',
    env: config.get('icmaa.mandant') + '-' + config.get('icmaa.environment'),
    clientToken: process.env.DD_CLIENT_TOKEN || config.get('extensions.icmaa-monitoring.datadog.clientToken'),
    analytics: true,
    logInjection: true
  })
}

export default tracer
