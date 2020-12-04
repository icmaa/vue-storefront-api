import { Router } from 'express'
import { apiStatus } from '../../../lib/util'

import NodeMailer from 'nodemailer'
import jwt from 'jwt-simple'

import GoogleRecaptcha from '../icmaa/helpers/googleRecaptcha'
import Redis from '../icmaa/helpers/redis'

module.exports = ({ config }) => {
  let api = Router()

  const tokenLimit = 5
  const getCurrentTimestamp = () => Math.floor(new Date().getTime() / 1000)

  api.get('/get-token', (req, res) => {
    const token = jwt.encode(getCurrentTimestamp(), config.extensions.mailService.secretString)
    apiStatus(res, token, 200)
  })

  api.post('/send-mail', async (req, res) => {
    const { name, recaptcha, ip } = req.body

    const recaptchaCheck = await GoogleRecaptcha(recaptcha, config)
    if (recaptchaCheck !== true) {
      apiStatus(res, recaptchaCheck, 500)
      return
    }

    if (ip) {
      const RedisTagCache = Redis(config, `mail-${name}`)
      if (await RedisTagCache.get(ip)) {
        apiStatus(res, 'Your IP has already been used.', 500)
        RedisTagCache.redis.quit()
        return
      }
      await RedisTagCache.set(ip, true, [])
      RedisTagCache.redis.quit()
    }

    const userData = req.body
    if (!userData.token) {
      apiStatus(res, 'Email is not authorized!', 500)
    }

    const currentTime = getCurrentTimestamp()
    const tokenTime = jwt.decode(userData.token, config.extensions.mailService.secretString)
    if (currentTime - tokenTime > tokenLimit) {
      apiStatus(res, 'Token has expired ', 500)
    }

    const { host, port, secure, user, pass } = config.extensions.mailService.transport
    if (!host || !port || !user || !pass) {
      apiStatus(res, 'No transport is defined for mail service!', 500)
    }
    if (!userData.sourceAddress) {
      apiStatus(res, 'Source email address is not provided!', 500)
      return
    }
    if (!userData.targetAddress) {
      apiStatus(res, 'Target email address is not provided!', 500)
      return
    }

    const whiteList = config.extensions.mailService.targetAddressWhitelist
    const email = userData.confirmation ? userData.sourceAddress : userData.targetAddress
    if (!whiteList.find(e => (email.startsWith(e) || email.endsWith(e)))) {
      apiStatus(res, `Target email address (${email}) is not from the whitelist!`, 500)
      return
    }

    const auth = { user, pass }
    let transporter = NodeMailer.createTransport({ auth, host, port, secure })

    const { text, html, replyTo } = userData
    const mailOptions = {
      from: userData.sourceAddress,
      to: userData.targetAddress,
      subject: userData.subject,
      replyTo,
      text,
      html
    }

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        apiStatus(res, error, 500)
        return
      }

      apiStatus(res, 'OK', 200)

      transporter.close()
    })
  })

  return api
}
