import config from 'config'
import tracer from 'dd-trace'
import winston from 'winston'

if (config.get('extensions.icmaa-monitoring.datadog.enabled') === true) {
  // Init datadog tracing agent
  tracer.init({
    service: 'vue-storefront-api',
    env: config.get('icmaa.mandant') + '-' + config.get('icmaa.environment'),
    clientToken: process.env.DD_CLIENT_TOKEN || config.get('extensions.icmaa-monitoring.datadog.clientToken'),
    analytics: true,
    logInjection: true
  })

  // Add logger to handle/log promise rejections
  const logger = winston.createLogger({
    format: winston.format.json(),
    transports: [
      new winston.transports.File({ filename: `${process.cwd()}/dist/log/winston.error.log`, level: 'error' }),
      new winston.transports.File({ filename: `${process.cwd()}/dist/log/winston.combined.log` })
    ],
    exitOnError: false,
    exceptionHandlers: [
      new winston.transports.File({ filename: `${process.cwd()}/dist/log/winston.error.log`, level: 'error' }),
      new winston.transports.File({ filename: `${process.cwd()}/dist/log/winston.combined.log` })
    ]
  })

  process.on('unhandledRejection', (error: any) => {
    logger.error(`Unhandled promise rejection`, error)
    console.error(`Unhandled promise rejection: ${error.message}`, error.stack || error)
  })
}

export default tracer
