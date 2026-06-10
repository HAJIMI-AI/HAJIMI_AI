const { createUniIdCoClient } = require('../adaptar/unicloude/uniIdCoClient.cjs')

const uniIdCoClient = createUniIdCoClient()

async function getAccountInfo({ clientInfo, uniIdToken, timeoutMs = 12000 }) {
  const res = await uniIdCoClient.call(
    'getAccountInfo',
    {
      clientInfo,
      uniIdToken: uniIdToken || '',
      params: {}
    },
    timeoutMs
  )

  const nicknameRaw = res?.nickname || res?.userInfo?.nickname || res?.data?.nickname || res?.data?.userInfo?.nickname
  const nickname = typeof nicknameRaw === 'string' && nicknameRaw.trim() ? nicknameRaw.trim() : null
  const uidRaw = res?.uid || res?.userInfo?._id || res?.data?.uid || res?.data?.userInfo?._id
  const uid = typeof uidRaw === 'string' && uidRaw.trim() ? uidRaw.trim() : null

  return { nickname, uid, raw: res }
}

module.exports = { getAccountInfo }
