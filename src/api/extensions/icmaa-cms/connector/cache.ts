import cache from '../../../../lib/cache-instance'
import { apiStatus } from '../../../../lib/util'

const cacheResult = (config: Record<string, any>, result: any, hash: string, tags: string[]): void => {
  if (config.server.useOutputCache && cache) {
    cache
      .set('api:' + hash, result, tags)
      .catch(err => {
        console.error(err)
      })
  }
}

const cacheHandler = async (config: Record<string, any>, res: Record<string, any>, hash: string, req: Record<string, any>): Promise<boolean|string> => {
  if (!req.header('X-VS-Cache-Bypass') && config.server.useOutputCache && cache) {
    return cache.get(
      'api:' + hash
    ).then(output => {
      if (output !== null) {
        res.setHeader('X-VS-Cache', 'Hit')
        return apiStatus(res, output, 200)
      }

      res.setHeader('X-VS-Cache', 'Miss')
      return false
    }).catch(err => {
      console.error(err)
      return false
    })
  }

  return new Promise(resolve => resolve(false))
}

export {
  cacheResult,
  cacheHandler
}
