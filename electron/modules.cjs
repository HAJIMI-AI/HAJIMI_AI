const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { readAppSettings } = require('./eventCenter.cjs')

function randomId() {
  try {
    const crypto = require('crypto')
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function getStoreFilePath() {
  const baseDir = app.getPath('userData')
  const userKey = readAppSettings().userKey
  const scope = userKey || 'anonymous'
  const dataDir = path.join(baseDir, 'store', 'users', scope)
  ensureDir(dataDir)
  return path.join(dataDir, 'models.json')
}

function readStore() {
  const filePath = getStoreFilePath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      models: Array.isArray(parsed.models) ? parsed.models : [],
      selectedModelId: typeof parsed.selectedModelId === 'string' ? parsed.selectedModelId : null
    }
  } catch {
    return { models: [], selectedModelId: null }
  }
}

function writeStore(next) {
  const filePath = getStoreFilePath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function normalizeModelInput(input) {
  const alias = typeof input?.alias === 'string' ? input.alias.trim() : ''
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const api_url = typeof input?.api_url === 'string' ? input.api_url.trim() : ''
  const api_token = typeof input?.api_token === 'string' ? input.api_token : ''
  return { alias, name, api_url, api_token }
}

function listModels() {
  const store = readStore()
  return store.models
}

function getModel(id) {
  const store = readStore()
  return store.models.find((m) => m.id === id) || null
}

function createModel(input) {
  const store = readStore()
  const { alias, name, api_url, api_token } = normalizeModelInput(input)

  if (!alias) throw new Error('alias is required')
  if (!name) throw new Error('name is required')

  const exists = store.models.some((m) => m.alias === alias)
  if (exists) throw new Error(`alias already exists: ${alias}`)

  const now = Date.now()
  const model = {
    id: randomId(),
    alias,
    name,
    api_url,
    api_token,
    createdAt: now,
    updatedAt: now
  }

  const next = {
    ...store,
    models: [...store.models, model]
  }
  writeStore(next)
  return model
}

function updateModel(id, patch) {
  const store = readStore()
  const index = store.models.findIndex((m) => m.id === id)
  if (index === -1) throw new Error('model not found')

  const current = store.models[index]
  const nextPatch = normalizeModelInput({
    alias: patch?.alias ?? current.alias,
    name: patch?.name ?? current.name,
    api_url: patch?.api_url ?? current.api_url,
    api_token: patch?.api_token ?? current.api_token
  })

  if (!nextPatch.alias) throw new Error('alias is required')
  if (!nextPatch.name) throw new Error('name is required')

  const aliasConflict = store.models.some((m) => m.id !== id && m.alias === nextPatch.alias)
  if (aliasConflict) throw new Error(`alias already exists: ${nextPatch.alias}`)

  const updated = {
    ...current,
    ...nextPatch,
    updatedAt: Date.now()
  }

  const models = store.models.slice()
  models[index] = updated

  writeStore({ ...store, models })
  return updated
}

function deleteModel(id) {
  const store = readStore()
  const exists = store.models.some((m) => m.id === id)
  if (!exists) return { deleted: false }

  const models = store.models.filter((m) => m.id !== id)
  const selectedModelId = store.selectedModelId === id ? null : store.selectedModelId
  writeStore({ models, selectedModelId })
  return { deleted: true }
}

function setSelectedModel(id) {
  const store = readStore()
  if (id !== null && typeof id !== 'string') throw new Error('id must be string or null')
  if (typeof id === 'string') {
    const exists = store.models.some((m) => m.id === id)
    if (!exists) throw new Error('model not found')
  }
  writeStore({ ...store, selectedModelId: id })
  return { selectedModelId: id }
}

function getSelectedModelId() {
  return readStore().selectedModelId
}

function getSelectedModel() {
  const store = readStore()
  if (!store.selectedModelId) return null
  return store.models.find((m) => m.id === store.selectedModelId) || null
}

async function testModelConnection(input) {
  const api_url = typeof input?.api_url === 'string' ? input.api_url.trim() : ''
  const api_token = typeof input?.api_token === 'string' ? input.api_token : ''
  const timeoutMs = typeof input?.timeoutMs === 'number' && Number.isFinite(input.timeoutMs) ? input.timeoutMs : 8000
  if (!api_url) throw new Error('api_url is required')

  let url
  try {
    url = new URL(api_url)
  } catch {
    throw new Error('api_url is invalid')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('api_url must be http or https')
  }

  const http = url.protocol === 'https:' ? require('https') : require('http')
  const startedAt = Date.now()

  return await new Promise((resolve) => {
    const req = http.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname || '/'}${url.search || ''}`,
        headers: {
          'User-Agent': 'common_electron_claude_base',
          Accept: '*/*',
          ...(api_token ? { Authorization: `Bearer ${api_token}` } : {})
        }
      },
      (res) => {
        const statusCode = typeof res?.statusCode === 'number' ? res.statusCode : 0
        res.resume()
        res.on('end', () => {
          const latencyMs = Date.now() - startedAt
          const ok = statusCode >= 200 && statusCode < 400
          const error =
            ok ? null : statusCode === 401 || statusCode === 403 ? `认证失败（${statusCode}）` : `响应异常（${statusCode || 'unknown'}）`
          resolve({ ok, latencyMs, statusCode, error })
        })
      }
    )

    req.on('timeout', () => {
      try {
        req.destroy(new Error('timeout'))
      } catch {}
    })

    req.on('error', (e) => {
      const latencyMs = Date.now() - startedAt
      resolve({ ok: false, latencyMs, error: e?.message || '网络错误' })
    })

    req.setTimeout(timeoutMs)
    req.end()
  })
}

function register(eventCenter) {
  eventCenter.register('modules', {
    listModels,
    getModel,
    createModel,
    updateModel,
    deleteModel,
    testModelConnection,
    setSelectedModel,
    getSelectedModelId,
    getSelectedModel
  })
}

module.exports = {
  register,
  listModels,
  getModel,
  createModel,
  updateModel,
  deleteModel,
  testModelConnection,
  setSelectedModel,
  getSelectedModelId,
  getSelectedModel
}
