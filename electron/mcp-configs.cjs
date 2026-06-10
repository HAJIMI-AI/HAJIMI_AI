const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { readAppSettings } = require('./eventCenter.cjs')

function randomId() {
  try {
    const crypto = require('crypto')
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  return `mcp_${Date.now()}_${Math.random().toString(16).slice(2)}`
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
  return path.join(dataDir, 'mcp-configs.json')
}

function readStore() {
  const filePath = getStoreFilePath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      configs: Array.isArray(parsed.configs) ? parsed.configs : []
    }
  } catch {
    return { configs: [] }
  }
}

function writeStore(next) {
  const filePath = getStoreFilePath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function listMcpConfigs(input) {
  const store = readStore()
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null

  if (appId) {
    return store.configs.filter(c => c.scope === 'shared' || c.scope === appId)
  }
  return store.configs
}

function writePluginManifest(dir, id, name, description) {
  const manifestDir = path.join(dir, '.claude-plugin')
  ensureDir(manifestDir)
  // Derive kebab slug: keep alphanumeric and CJK chars, replace everything else with -
  const raw = name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  // Take first 32 chars of slug + append id suffix for uniqueness
  const prefix = raw.slice(0, 32) || 'plugin'
  // Use last 8 chars of id as unique suffix
  const suffix = id.replace(/[_-]/g, '').slice(-8)
  const pluginName = `${prefix}-${suffix}`.toLowerCase()
  const manifest = {
    name: pluginName,
    version: '1.0.0',
    description: description || name
  }
  fs.writeFileSync(path.join(manifestDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8')
}

function buildMcpPluginDirectory(mcpId, name, description, config) {
  const baseDir = app.getPath('userData')
  const pluginDir = path.join(baseDir, 'mcp-plugins', mcpId)

  // Clear existing if any
  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true, force: true })
  }

  ensureDir(pluginDir)

  // Standard Claude plugin manifest
  writePluginManifest(pluginDir, mcpId, name, description)

  // MCP server definitions (SDK standard: .mcp.json at plugin root)
  fs.writeFileSync(path.join(pluginDir, '.mcp.json'), JSON.stringify(config, null, 2), 'utf8')

  return pluginDir
}

function createMcpConfig(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const description = typeof input?.description === 'string' ? input.description.trim() : ''
  const config = input?.config && typeof input.config === 'object' ? input.config : null

  if (!name) throw new Error('name is required')
  if (!config || Object.keys(config).length === 0) throw new Error('config is required')

  const id = randomId()
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null
  const scope = appId || 'shared'
  const now = Date.now()

  // Build standalone Claude plugin directory
  const directory = buildMcpPluginDirectory(id, name, description, config)

  const item = {
    id,
    name,
    description,
    scope,
    config,
    directory,
    createdAt: now,
    updatedAt: now
  }

  const store = readStore()
  writeStore({ configs: [item, ...store.configs] })
  return item
}

function updateMcpConfig(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const index = store.configs.findIndex(c => c.id === id)
  if (index === -1) throw new Error('config not found')

  const current = store.configs[index]
  const name = typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : current.name
  const description = input?.description !== undefined ? (typeof input.description === 'string' ? input.description.trim() : '') : (current.description || '')
  const config = input?.config && typeof input.config === 'object' ? input.config : undefined

  if (!name) throw new Error('name is required')

  const updated = {
    ...current,
    name,
    description,
    ...(config !== undefined ? { config } : {}),
    updatedAt: Date.now()
  }

  // Rebuild plugin directory when config changes
  if (config !== undefined) {
    updated.directory = buildMcpPluginDirectory(id, updated.name, updated.description, updated.config)
  }

  const configs = store.configs.slice()
  configs[index] = updated
  writeStore({ configs })
  return updated
}

function deleteMcpConfig(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const item = store.configs.find(c => c.id === id)
  if (!item) throw new Error('config not found')

  // Hard delete: remove plugin directory and record
  try {
    if (item.directory) fs.rmSync(item.directory, { recursive: true, force: true })
  } catch { /* best effort */ }

  const configs = store.configs.filter(c => c.id !== id)
  writeStore({ configs })
  return { ok: true }
}

function getMcpConfig(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const item = store.configs.find(c => c.id === id)
  if (!item) throw new Error('config not found')
  return item
}

function getMcpConfigsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const store = readStore()
  return ids.map(id => store.configs.find(c => c.id === id)).filter(Boolean)
}

function getMcpConfigById(id) {
  const store = readStore()
  return store.configs.find(c => c.id === id) || null
}

function getMcpPluginPath(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const item = store.configs.find(c => c.id === id)
  if (!item) throw new Error('config not found')
  if (!item.directory) throw new Error('config has no plugin directory')

  return { path: item.directory }
}

function register(eventCenter) {
  eventCenter.register('mcpConfigs', {
    listMcpConfigs,
    createMcpConfig,
    updateMcpConfig,
    deleteMcpConfig,
    getMcpConfig,
    getMcpConfigsByIds,
    getMcpPluginPath
  })
}

module.exports = {
  register,
  listMcpConfigs,
  createMcpConfig,
  updateMcpConfig,
  deleteMcpConfig,
  getMcpConfig,
  getMcpConfigsByIds,
  getMcpConfigById,
  getMcpPluginPath
}
