import { Router } from 'express'
import { apiStatus } from '../../../lib/util'
import { newMagentoClientAction } from '../icmaa/helpers'

module.exports = ({ config }) => {
  let api = Router()

  const urlPrefix = 'newsletter/'

  const action = (endpoint = 'subscribe') => async (req, res) => {
    const client = newMagentoClientAction('newsletter', endpoint, urlPrefix, config, req)
    client.newsletter[endpoint](req.body)
      .then((result) => {
        apiStatus(res, result, 200)
      }).catch(err => {
        apiStatus(res, err, 500)
      })
  }

  api.post('/subscribe', action())
  api.delete('/subscribe', action())

  api.post('/voucher', action('voucher'))
  api.post('/birthday-voucher', action('birthdayvoucher'))

  return api
}
