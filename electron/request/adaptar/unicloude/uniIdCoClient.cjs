const https = require('https')
const http = require('http')
const { loadUrlsConfig } = require('../../../config/index.cjs')

function getUniIdCoUrl() {
  const envUrl = typeof process.env.UNI_ID_CO_URL === 'string' ? process.env.UNI_ID_CO_URL.trim() : ''
  const { uniIdCoUrl } = loadUrlsConfig()
  return envUrl || uniIdCoUrl
}

async function postJson(urlString, body, timeoutMs = 12000, extraHeaders) {
  const headers = { 'Content-Type': 'application/json', ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {}) }
  if (typeof fetch === 'function') {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(urlString, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      return json
    } finally {
      clearTimeout(timer)
    }
  }

  const u = new URL(urlString)
  const lib = u.protocol === 'http:' ? http : https

  const payload = JSON.stringify(body)
  return await new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: `${u.pathname}${u.search || ''}`,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {})
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      try {
        req.destroy(new Error('timeout'))
      } catch {}
    })
    req.write(payload)
    req.end()
  })
}

function createUniIdCoClient({ baseUrl } = {}) {
  const resolvedBaseUrl = (baseUrl || getUniIdCoUrl()).replace(/\/+$/, '')

  return {
    async call(action, { clientInfo, uniIdToken, params, headers } = {}, timeoutMs) {
      const url = `${resolvedBaseUrl}/${String(action || '').replace(/^\/+/, '')}`
      const res = await postJson(
        url,
        {
          clientInfo: clientInfo || {},
          uniIdToken: uniIdToken || '',
          params: params || {}
        },
        timeoutMs,
        headers
      )

      const errCode = res?.errCode
      if (errCode && errCode !== 0) {
        const msg = typeof res?.errMsg === 'string' && res.errMsg.trim() ? res.errMsg.trim() : String(errCode)
        const error = new Error(msg)
        const errCodeStr = typeof errCode === 'string' ? errCode : ''
        const msgLower = typeof msg === 'string' ? msg.toLowerCase() : ''
        const authInvalid =
          (errCodeStr && errCodeStr.startsWith('uni-id-token')) ||
          (/token/i.test(errCodeStr) && /(invalid|expired)/i.test(errCodeStr)) ||
          (msgLower.includes('token') && (msgLower.includes('invalid') || msgLower.includes('expired'))) ||
          (msg.includes('token') && (msg.includes('无效') || msg.includes('过期')))

        error.code = errCode
        error.authInvalid = authInvalid
        error.payload = res
        throw error
      }

      return res
    }
  }
}

module.exports = { createUniIdCoClient }
