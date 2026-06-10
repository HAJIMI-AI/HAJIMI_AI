const { createUniIdCoClient } = require('../adaptar/unicloude/uniIdCoClient.cjs')

const uniIdCoClient = createUniIdCoClient()

async function createCaptcha({ clientInfo, scene, timeoutMs = 12000 }) {
  const res = await uniIdCoClient.call(
    'createCaptcha',
    {
      clientInfo,
      uniIdToken: '',
      params: { scene }
    },
    timeoutMs
  )
  const captchaBase64 = typeof res?.captchaBase64 === 'string' ? res.captchaBase64 : ''
  if (!captchaBase64) throw new Error('uni-id-co did not return captchaBase64')
  return { captchaBase64 }
}

async function refreshCaptcha({ clientInfo, scene, timeoutMs = 12000 }) {
  const res = await uniIdCoClient.call(
    'refreshCaptcha',
    {
      clientInfo,
      uniIdToken: '',
      params: { scene }
    },
    timeoutMs
  )
  const captchaBase64 = typeof res?.captchaBase64 === 'string' ? res.captchaBase64 : ''
  if (!captchaBase64) throw new Error('uni-id-co did not return captchaBase64')
  return { captchaBase64 }
}

async function login({ clientInfo, username, password, timeoutMs = 12000 }) {
  return await uniIdCoClient.call(
    'login',
    {
      clientInfo,
      uniIdToken: '',
      params: { username, password }
    },
    timeoutMs
  )
}

async function registerUser({ clientInfo, username, password, captcha, nickname, timeoutMs = 12000 }) {
  return await uniIdCoClient.call(
    'registerUser',
    {
      clientInfo,
      uniIdToken: '',
      params: {
        username,
        password,
        captcha,
        ...(nickname ? { nickname } : {})
      }
    },
    timeoutMs
  )
}

async function logout({ clientInfo, uniIdToken, timeoutMs = 8000 }) {
  return await uniIdCoClient.call(
    'logout',
    {
      clientInfo,
      uniIdToken: uniIdToken || '',
      params: {}
    },
    timeoutMs
  )
}

async function refreshToken({ clientInfo, uniIdToken, timeoutMs = 12000 }) {
  return await uniIdCoClient.call(
    'refreshToken',
    {
      clientInfo,
      uniIdToken: uniIdToken || '',
      params: {}
    },
    timeoutMs
  )
}

async function updatePwd({ clientInfo, uniIdToken, oldPassword, newPassword, timeoutMs = 12000 }) {
  return await uniIdCoClient.call(
    'updatePwd',
    {
      clientInfo,
      uniIdToken: uniIdToken || '',
      params: { oldPassword, newPassword }
    },
    timeoutMs
  )
}

module.exports = { createCaptcha, refreshCaptcha, login, registerUser, logout, refreshToken, updatePwd }
