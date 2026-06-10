const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { readAppSettings } = require('./eventCenter.cjs')
const skills = require('./skills.cjs')
const mcpConfigs = require('./mcp-configs.cjs')

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
  return path.join(dataDir, 'plugin-packs.json')
}

function readStore() {
  const filePath = getStoreFilePath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      packs: Array.isArray(parsed.packs) ? parsed.packs : []
    }
  } catch {
    return { packs: [] }
  }
}

function writeStore(next) {
  const filePath = getStoreFilePath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_').slice(0, 64) || 'pack'
}

function writePluginManifest(dir, id, name, description) {
  const manifestDir = path.join(dir, '.claude-plugin')
  ensureDir(manifestDir)
  const raw = name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const prefix = raw.slice(0, 32) || 'pack'
  const suffix = id.replace(/[_-]/g, '').slice(-8)
  const pluginName = `${prefix}-${suffix}`.toLowerCase()
  const manifest = {
    name: pluginName,
    version: '1.0.0',
    description: description || name
  }
  fs.writeFileSync(path.join(manifestDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8')
}

/** Resolve the actual skill content directory from a skill plugin directory.
 *  New standard: {plugin}/skills/{name}/SKILL.md
 *  Legacy:       {plugin}/SKILL.md (at plugin root) */
function resolveSkillContentDir(skill) {
  const srcSkillsRoot = path.join(skill.directory, 'skills')
  if (fs.existsSync(srcSkillsRoot)) {
    const entries = fs.readdirSync(srcSkillsRoot, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const candidate = path.join(srcSkillsRoot, e.name)
      if (fs.existsSync(path.join(candidate, 'SKILL.md'))) {
        return candidate
      }
    }
  }
  // Fallback: legacy skill with SKILL.md at plugin root
  if (fs.existsSync(path.join(skill.directory, 'SKILL.md'))) {
    return skill.directory
  }
  return null
}

function buildPackDirectory(packId, packName, packDescription, skillIds, mcpConfigIds) {
  const baseDir = app.getPath('userData')
  const packDir = path.join(baseDir, 'plugin-packs', packId)

  // Clear existing if any
  if (fs.existsSync(packDir)) {
    fs.rmSync(packDir, { recursive: true, force: true })
  }

  ensureDir(packDir)

  // Standard Claude plugin manifest (root level)
  writePluginManifest(packDir, packId, packName, packDescription)

  // Copy skills into skills/ (standard: skills/name/SKILL.md)
  if (skillIds.length > 0) {
    const packSkillsDir = path.join(packDir, 'skills')
    ensureDir(packSkillsDir)

    for (const sid of skillIds) {
      const skill = skills.getSkillById(sid)
      if (!skill) continue

      const srcDir = resolveSkillContentDir(skill)
      if (!srcDir) continue

      const destName = sanitizeName(path.basename(srcDir))
      const dest = path.join(packSkillsDir, destName)
      let finalDest = dest
      let counter = 1
      while (fs.existsSync(finalDest)) {
        finalDest = `${dest}_${counter}`
        counter++
      }
      fs.cpSync(srcDir, finalDest, { recursive: true })
    }
  }

  // Write merged .mcp.json at plugin root (standard location)
  if (Array.isArray(mcpConfigIds) && mcpConfigIds.length > 0) {
    const mergedServers = {}
    for (const cid of mcpConfigIds) {
      const cfg = mcpConfigs.getMcpConfigById(cid)
      if (!cfg || !cfg.config || typeof cfg.config !== 'object') continue
      const servers = cfg.config.mcpServers
      if (servers && typeof servers === 'object') {
        Object.assign(mergedServers, servers)
      } else {
        Object.assign(mergedServers, cfg.config)
      }
    }
    if (Object.keys(mergedServers).length > 0) {
      fs.writeFileSync(path.join(packDir, '.mcp.json'), JSON.stringify({ mcpServers: mergedServers }, null, 2), 'utf8')
    }
  }

  return packDir
}

function listPluginPacks(input) {
  const store = readStore()
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null

  if (appId) {
    return store.packs.filter(p => p.scope === 'shared' || p.scope === appId)
  }
  return store.packs
}

function createPluginPack(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const description = typeof input?.description === 'string' ? input.description.trim() : ''
  const skillIds = Array.isArray(input?.skillIds) ? input.skillIds.filter(id => typeof id === 'string' && id.trim()) : []
  const mcpConfigIds = Array.isArray(input?.mcpConfigIds) ? input.mcpConfigIds.filter(id => typeof id === 'string' && id.trim()) : []
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null
  const scope = appId || 'shared'

  if (!name) throw new Error('name is required')
  if (skillIds.length === 0 && mcpConfigIds.length === 0) throw new Error('at least one skill or MCP config is required')

  const id = randomId()
  const directory = buildPackDirectory(id, name, description, skillIds, mcpConfigIds)

  // Embed skill/MCP info so the pack is self-describing
  const embeddedSkills = skillIds.map(sid => {
    const s = skills.getSkillById(sid)
    return s ? { id: sid, name: s.name } : { id: sid, name: '已删除', deleted: true }
  })
  const embeddedMcpConfigs = mcpConfigIds.map(cid => {
    const c = mcpConfigs.getMcpConfigById(cid)
    return c ? { id: cid, name: c.name } : { id: cid, name: '已删除', deleted: true }
  })

  const now = Date.now()
  const pack = {
    id,
    name,
    description,
    scope,
    skillIds,
    embeddedSkills,
    mcpConfigIds,
    embeddedMcpConfigs,
    directory,
    hasMcp: mcpConfigIds.length > 0,
    createdAt: now,
    updatedAt: now
  }

  const store = readStore()
  writeStore({ packs: [pack, ...store.packs] })
  return pack
}

function updatePluginPack(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const index = store.packs.findIndex(p => p.id === id)
  if (index === -1) throw new Error('pack not found')

  const current = store.packs[index]

  const name = typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : current.name
  const description = typeof input?.description === 'string' ? input.description.trim() : current.description
  const skillIds = Array.isArray(input?.skillIds) ? input.skillIds.filter(id => typeof id === 'string' && id.trim()) : current.skillIds
  const mcpConfigIds = input?.mcpConfigIds !== undefined
    ? (Array.isArray(input.mcpConfigIds) ? input.mcpConfigIds.filter(id => typeof id === 'string' && id.trim()) : [])
    : (current.mcpConfigIds || [])

  if (!name) throw new Error('name is required')
  if (skillIds.length === 0 && mcpConfigIds.length === 0) throw new Error('at least one skill or MCP config is required')

  const directory = buildPackDirectory(id, name, description, skillIds, mcpConfigIds)

  // Rebuild embedded info
  const embeddedSkills = skillIds.map(sid => {
    const s = skills.getSkillById(sid)
    return s ? { id: sid, name: s.name } : { id: sid, name: '已删除', deleted: true }
  })
  const embeddedMcpConfigs = mcpConfigIds.map(cid => {
    const c = mcpConfigs.getMcpConfigById(cid)
    return c ? { id: cid, name: c.name } : { id: cid, name: '已删除', deleted: true }
  })

  const updated = {
    ...current,
    name,
    description,
    skillIds,
    embeddedSkills,
    mcpConfigIds,
    embeddedMcpConfigs,
    directory,
    hasMcp: mcpConfigIds.length > 0,
    updatedAt: Date.now()
  }

  const packs = store.packs.slice()
  packs[index] = updated
  writeStore({ packs })
  return updated
}

function deletePluginPack(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const pack = store.packs.find(p => p.id === id)
  if (!pack) throw new Error('pack not found')

  // Hard delete: remove directory and record
  try {
    fs.rmSync(pack.directory, { recursive: true, force: true })
  } catch { /* best effort */ }

  const packs = store.packs.filter(p => p.id !== id)
  writeStore({ packs })
  return { ok: true }
}

function getPluginPath(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const pack = store.packs.find(p => p.id === id)
  if (!pack) throw new Error('pack not found')

  return { path: pack.directory }
}

function register(eventCenter) {
  eventCenter.register('pluginPacks', {
    listPluginPacks,
    createPluginPack,
    updatePluginPack,
    deletePluginPack,
    getPluginPath
  })
}

module.exports = {
  register,
  listPluginPacks,
  createPluginPack,
  updatePluginPack,
  deletePluginPack,
  getPluginPath
}
