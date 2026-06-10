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
  return path.join(dataDir, 'sessions.json')
}

function readStore() {
  const filePath = getStoreFilePath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      currentSessionId: typeof parsed.currentSessionId === 'string' ? parsed.currentSessionId : null
    }
  } catch {
    return { sessions: [], currentSessionId: null }
  }
}

function writeStore(next) {
  const filePath = getStoreFilePath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function normalizeTitle(title) {
  const t = typeof title === 'string' ? title.trim() : ''
  return t || 'New chat'
}

function normalizeAgentIds(agentIds) {
  const ids = Array.isArray(agentIds) ? agentIds : []
  const cleaned = ids
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

function listSessions() {
  return readStore().sessions
}

function getSession(id) {
  const store = readStore()
  return store.sessions.find((s) => s.id === id) || null
}

function createSession(input) {
  const agentId = typeof input?.agentId === 'string' ? input.agentId.trim() : ''
  if (!agentId) throw new Error('agentId is required')

  const now = Date.now()
  const session = {
    id: randomId(),
    title: normalizeTitle(input?.title),
    type: 'single',
    agentIds: [agentId],
    agentSessionIds: {},
    createdAt: now,
    updatedAt: now
  }

  const store = readStore()
  const next = {
    ...store,
    sessions: [session, ...store.sessions],
    currentSessionId: session.id
  }
  writeStore(next)
  return session
}

function createGroupSession(input) {
  const agentIds = normalizeAgentIds(input?.agentIds)
  if (agentIds.length < 2) throw new Error('group session requires at least 2 agentIds')

  const now = Date.now()
  const session = {
    id: randomId(),
    title: normalizeTitle(input?.title),
    type: 'group',
    agentIds,
    agentSessionIds: {},
    createdAt: now,
    updatedAt: now
  }

  const store = readStore()
  const next = {
    ...store,
    sessions: [session, ...store.sessions],
    currentSessionId: session.id
  }
  writeStore(next)
  return session
}

function updateSession(id, patch) {
  const store = readStore()
  const index = store.sessions.findIndex((s) => s.id === id)
  if (index === -1) throw new Error('session not found')

  const current = store.sessions[index]
  const updated = {
    ...current,
    title: patch?.title === undefined ? current.title : normalizeTitle(patch.title),
    updatedAt: Date.now()
  }

  const sessions = store.sessions.slice()
  sessions[index] = updated
  writeStore({ ...store, sessions })
  return updated
}

function deleteSession(id) {
  const store = readStore()
  const exists = store.sessions.some((s) => s.id === id)
  if (!exists) return { deleted: false }

  const sessions = store.sessions.filter((s) => s.id !== id)
  const currentSessionId = store.currentSessionId === id ? null : store.currentSessionId
  writeStore({ sessions, currentSessionId })
  return { deleted: true }
}

function setCurrentSession(id) {
  const store = readStore()
  if (id !== null && typeof id !== 'string') throw new Error('id must be string or null')
  if (typeof id === 'string') {
    const exists = store.sessions.some((s) => s.id === id)
    if (!exists) throw new Error('session not found')
  }
  writeStore({ ...store, currentSessionId: id })
  return { currentSessionId: id }
}

function getCurrentSessionId() {
  return readStore().currentSessionId
}

function getCurrentSession() {
  const store = readStore()
  if (!store.currentSessionId) return null
  return store.sessions.find((s) => s.id === store.currentSessionId) || null
}

function setAgentSessionId(localSessionId, agentId, agentSessionId) {
  const store = readStore()
  const index = store.sessions.findIndex((s) => s.id === localSessionId)
  if (index === -1) throw new Error('session not found')
  if (typeof agentId !== 'string' || !agentId.trim()) throw new Error('agentId is required')
  if (typeof agentSessionId !== 'string' || !agentSessionId.trim()) throw new Error('agentSessionId is required')

  const current = store.sessions[index]
  if (!current.agentIds.includes(agentId)) throw new Error('agentId not in session')

  const updated = {
    ...current,
    agentSessionIds: { ...(current.agentSessionIds || {}), [agentId]: agentSessionId },
    updatedAt: Date.now()
  }
  const sessions = store.sessions.slice()
  sessions[index] = updated
  writeStore({ ...store, sessions })
  return updated
}

function addAgentToGroup(localSessionId, agentId) {
  const store = readStore()
  const index = store.sessions.findIndex((s) => s.id === localSessionId)
  if (index === -1) throw new Error('session not found')

  const current = store.sessions[index]
  if (current.type !== 'group') throw new Error('not a group session')
  if (typeof agentId !== 'string' || !agentId.trim()) throw new Error('agentId is required')

  const agentIds = Array.from(new Set([...current.agentIds, agentId.trim()]))
  const updated = { ...current, agentIds, updatedAt: Date.now() }

  const sessions = store.sessions.slice()
  sessions[index] = updated
  writeStore({ ...store, sessions })
  return updated
}

function removeAgentFromGroup(localSessionId, agentId) {
  const store = readStore()
  const index = store.sessions.findIndex((s) => s.id === localSessionId)
  if (index === -1) throw new Error('session not found')

  const current = store.sessions[index]
  if (current.type !== 'group') throw new Error('not a group session')
  if (typeof agentId !== 'string' || !agentId.trim()) throw new Error('agentId is required')

  const agentIds = current.agentIds.filter((x) => x !== agentId.trim())
  if (agentIds.length < 2) throw new Error('group session requires at least 2 agents')

  const agentSessionIds = { ...(current.agentSessionIds || {}) }
  delete agentSessionIds[agentId.trim()]

  const updated = { ...current, agentIds, agentSessionIds, updatedAt: Date.now() }
  const sessions = store.sessions.slice()
  sessions[index] = updated
  writeStore({ ...store, sessions })
  return updated
}

function register(eventCenter) {
  eventCenter.register('sessions', {
    listSessions,
    getSession,
    createSession,
    createGroupSession,
    updateSession,
    deleteSession,
    setCurrentSession,
    getCurrentSessionId,
    getCurrentSession,
    setAgentSessionId,
    addAgentToGroup,
    removeAgentFromGroup
  })
}

module.exports = {
  register,
  listSessions,
  getSession,
  createSession,
  createGroupSession,
  updateSession,
  deleteSession,
  setCurrentSession,
  getCurrentSessionId,
  getCurrentSession,
  setAgentSessionId,
  addAgentToGroup,
  removeAgentFromGroup
}
