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
  return path.join(dataDir, 'assistants.json')
}

function readStore() {
  const filePath = getStoreFilePath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      assistants: Array.isArray(parsed.assistants) ? parsed.assistants : [],
      currentAssistantId:
        typeof parsed.currentAssistantId === 'string' ? parsed.currentAssistantId : null
    }
  } catch {
    return { assistants: [], currentAssistantId: null }
  }
}

function writeStore(next) {
  const filePath = getStoreFilePath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function listAssistants() {
  return readStore().assistants
}

function getAssistant(id) {
  const store = readStore()
  return store.assistants.find((a) => a.id === id) || null
}

function createAssistant(input) {
  const name = normalizeString(input?.name)
  if (!name) throw new Error('name is required')

  const now = Date.now()
  const assistant = {
    id: randomId(),
    name,
    description: normalizeString(input?.description),
    avatar: typeof input?.avatar === 'string' ? input.avatar : '',
    modelId: normalizeString(input?.modelId) || null,
    agentId: normalizeString(input?.agentId) || null,
    createdAt: now,
    updatedAt: now
  }

  const store = readStore()
  const next = {
    ...store,
    assistants: [assistant, ...store.assistants],
    currentAssistantId: assistant.id
  }
  writeStore(next)
  return assistant
}

function updateAssistant(id, patch) {
  const store = readStore()
  const index = store.assistants.findIndex((a) => a.id === id)
  if (index === -1) throw new Error('assistant not found')

  const current = store.assistants[index]
  const nextName = patch?.name === undefined ? current.name : normalizeString(patch.name)
  if (!nextName) throw new Error('name is required')

  const updated = {
    ...current,
    name: nextName,
    description:
      patch?.description === undefined ? current.description : normalizeString(patch.description),
    avatar: patch?.avatar === undefined ? current.avatar : typeof patch.avatar === 'string' ? patch.avatar : '',
    modelId:
      patch?.modelId === undefined
        ? current.modelId
        : normalizeString(patch.modelId) || null,
    agentId:
      patch?.agentId === undefined
        ? current.agentId
        : normalizeString(patch.agentId) || null,
    updatedAt: Date.now()
  }

  const assistants = store.assistants.slice()
  assistants[index] = updated
  writeStore({ ...store, assistants })
  return updated
}

function deleteAssistant(id) {
  const store = readStore()
  const exists = store.assistants.some((a) => a.id === id)
  if (!exists) return { deleted: false }

  const assistants = store.assistants.filter((a) => a.id !== id)
  const currentAssistantId = store.currentAssistantId === id ? null : store.currentAssistantId
  writeStore({ assistants, currentAssistantId })
  return { deleted: true }
}

function setCurrentAssistant(id) {
  const store = readStore()
  if (id !== null && typeof id !== 'string') throw new Error('id must be string or null')
  if (typeof id === 'string') {
    const exists = store.assistants.some((a) => a.id === id)
    if (!exists) throw new Error('assistant not found')
  }
  writeStore({ ...store, currentAssistantId: id })
  return { currentAssistantId: id }
}

function getCurrentAssistantId() {
  return readStore().currentAssistantId
}

function getCurrentAssistant() {
  const store = readStore()
  if (!store.currentAssistantId) return null
  return store.assistants.find((a) => a.id === store.currentAssistantId) || null
}

function register(eventCenter) {
  eventCenter.register('assistant', {
    listAssistants,
    getAssistant,
    createAssistant,
    updateAssistant,
    deleteAssistant,
    setCurrentAssistant,
    getCurrentAssistantId,
    getCurrentAssistant
  })
}

module.exports = {
  register,
  listAssistants,
  getAssistant,
  createAssistant,
  updateAssistant,
  deleteAssistant,
  setCurrentAssistant,
  getCurrentAssistantId,
  getCurrentAssistant
}
