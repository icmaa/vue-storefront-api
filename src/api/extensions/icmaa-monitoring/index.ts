import { Router } from 'express'
import winston from 'winston'
import expressWinston from 'express-winston'

module.exports = ({ config }) => {
  let app = Router()

  if (config.get('extensions.icmaa-monitoring.datadog.enabled') === true) {
    app.use(expressWinston.logger({
      transports: [
        new winston.transports.File({ filename: `${process.cwd()}/dist/log/winston.error.log`, level: 'error' }),
        new winston.transports.File({ filename: `${process.cwd()}/dist/log/winston.combined.log` })
      ],
      format: winston.format.json()
    }))
  }

  return app
}
