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
  return path.join(dataDir, 'skills.json')
}

function readStore() {
  const filePath = getStoreFilePath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : []
    }
  } catch {
    return { skills: [] }
  }
}

function writeStore(next) {
  const filePath = getStoreFilePath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function countFilesRecursive(dir) {
  let count = 0
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      count++
      if (e.isDirectory()) {
        count += countFilesRecursive(path.join(dir, e.name))
      }
    }
  } catch { /* ignore */ }
  return count
}

function sanitizeName(name) {
  // Generate a safe directory name from user input
  return name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_').slice(0, 64) || 'skill'
}

function writePluginManifest(dir, id, name) {
  const manifestDir = path.join(dir, '.claude-plugin')
  ensureDir(manifestDir)
  const raw = name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const prefix = raw.slice(0, 32) || 'skill'
  const suffix = id.replace(/[_-]/g, '').slice(-8)
  const pluginName = `${prefix}-${suffix}`.toLowerCase()
  const manifest = {
    name: pluginName,
    version: '1.0.0',
    description: name
  }
  fs.writeFileSync(path.join(manifestDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8')
}

function listSkills(input) {
  const store = readStore()
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null

  if (appId) {
    return store.skills.filter(s => s.scope === 'shared' || s.scope === appId)
  }
  return store.skills
}

function uploadSkill(input) {
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null
  const scope = appId || 'shared'
  const sourceDirectory = typeof input?.sourceDirectory === 'string' ? input.sourceDirectory.trim() : ''
  const userProvidedName = typeof input?.name === 'string' ? input.name.trim() : ''

  if (!sourceDirectory) throw new Error('sourceDirectory is required')
  if (!fs.existsSync(sourceDirectory)) throw new Error('source directory not found')

  // Validate SKILL.md exists at root of selected directory
  const skillMdPath = path.join(sourceDirectory, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) throw new Error('SKILL.md not found in selected directory')

  const id = randomId()
  const baseDir = app.getPath('userData')
  const destDir = path.join(baseDir, 'skills', scope, id)
  ensureDir(destDir)

  // Derive name: user-provided > directory basename
  const name = userProvidedName || path.basename(sourceDirectory)

  // Standard Claude plugin: skills go under skills/{name}/, preserve original dir name
  const safeName = sanitizeName(path.basename(sourceDirectory))
  const skillsDir = path.join(destDir, 'skills', safeName)
  ensureDir(skillsDir)

  // Copy source into skills/{name}/
  fs.cpSync(sourceDirectory, skillsDir, { recursive: true })

  // Inject standard Claude plugin manifest at plugin root
  writePluginManifest(destDir, id, name)

  const fileCount = countFilesRecursive(destDir)
  const now = Date.now()
  const skill = {
    id,
    name,
    scope,
    directory: destDir,
    sourceDirectory,
    fileCount,
    createdAt: now,
    updatedAt: now
  }

  const store = readStore()
  writeStore({ skills: [skill, ...store.skills] })
  return skill
}

function deleteSkill(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const skill = store.skills.find(s => s.id === id)
  if (!skill) throw new Error('skill not found')

  // Hard delete: remove files and record
  try {
    fs.rmSync(skill.directory, { recursive: true, force: true })
  } catch { /* best effort */ }

  const skills = store.skills.filter(s => s.id !== id)
  writeStore({ skills })
  return { ok: true }
}

function updateSkill(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!id) throw new Error('id is required')
  if (!name) throw new Error('name is required')

  const store = readStore()
  const index = store.skills.findIndex(s => s.id === id)
  if (index === -1) throw new Error('skill not found')

  const updated = {
    ...store.skills[index],
    name,
    updatedAt: Date.now()
  }

  const skills = store.skills.slice()
  skills[index] = updated
  writeStore({ skills })
  return updated
}

function getPluginPath(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const skill = store.skills.find(s => s.id === id)
  if (!skill) throw new Error('skill not found')

  return { path: skill.directory }
}

function readSkillMd(input) {
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (!id) throw new Error('id is required')

  const store = readStore()
  const skill = store.skills.find(s => s.id === id)
  if (!skill) throw new Error('skill not found')

  // Standard plugin: SKILL.md is under skills/{name}/SKILL.md
  // Scan skills/ subdirectory to find it (there should be exactly one skill dir)
  const skillsRoot = path.join(skill.directory, 'skills')
  let skillMdPath = ''
  if (fs.existsSync(skillsRoot)) {
    const entries = fs.readdirSync(skillsRoot, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const candidate = path.join(skillsRoot, e.name, 'SKILL.md')
      if (fs.existsSync(candidate)) {
        skillMdPath = candidate
        break
      }
    }
  }
  // Fallback for legacy skills (SKILL.md at root)
  if (!skillMdPath) {
    const legacy = path.join(skill.directory, 'SKILL.md')
    if (fs.existsSync(legacy)) skillMdPath = legacy
  }
  if (!skillMdPath) throw new Error('SKILL.md not found')

  const raw = fs.readFileSync(skillMdPath, 'utf8')

  // Parse YAML frontmatter
  let content = raw
  let frontmatter = {}
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fmMatch) {
    content = raw.slice(fmMatch[0].length)
    // Simple YAML parser for name, description
    const lines = fmMatch[1].split('\n')
    for (const line of lines) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*)$/)
      if (kv) {
        const key = kv[1]
        let val = kv[2].trim()
        // Unquote strings
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        frontmatter[key] = val
      }
    }
  }

  return {
    path: skillMdPath,
    content,
    frontmatter
  }
}

// Scan parent directory for subdirectories that contain SKILL.md
function scanSkillDirs(input) {
  const parentDir = typeof input?.parentDirectory === 'string' ? input.parentDirectory.trim() : ''
  if (!parentDir) throw new Error('parentDirectory is required')
  if (!fs.existsSync(parentDir)) throw new Error('parent directory not found')

  const results = []
  try {
    const entries = fs.readdirSync(parentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const fullPath = path.join(parentDir, entry.name)
      const hasSkillMd = fs.existsSync(path.join(fullPath, 'SKILL.md'))
      const fileCount = hasSkillMd ? countFilesRecursive(fullPath) : 0
      results.push({
        name: entry.name,
        path: fullPath,
        hasSkillMd,
        fileCount
      })
    }
  } catch { /* ignore read errors */ }

  return { directories: results }
}

// Batch upload multiple skills at once
function uploadSkills(input) {
  const appId = typeof input?.appId === 'string' && input.appId.trim() ? input.appId.trim() : null
  const scope = appId || 'shared'
  const items = Array.isArray(input?.items) ? input.items : []

  if (!items.length) throw new Error('items array is required and must not be empty')

  const results = []
  const errors = []

  for (const item of items) {
    const sourceDirectory = typeof item?.sourceDirectory === 'string' ? item.sourceDirectory.trim() : ''
    const userProvidedName = typeof item?.name === 'string' ? item.name.trim() : ''

    try {
      if (!sourceDirectory) throw new Error('sourceDirectory is required')
      if (!fs.existsSync(sourceDirectory)) throw new Error('source directory not found')

      const skillMdPath = path.join(sourceDirectory, 'SKILL.md')
      if (!fs.existsSync(skillMdPath)) throw new Error('SKILL.md not found in selected directory')

      const id = randomId()
      const baseDir = app.getPath('userData')
      const destDir = path.join(baseDir, 'skills', scope, id)
      ensureDir(destDir)

      const name = userProvidedName || path.basename(sourceDirectory)

      // Standard Claude plugin: skills go under skills/{name}/, preserve original dir name
      const dirName = sanitizeName(path.basename(sourceDirectory))
      const skillDir = path.join(destDir, 'skills', dirName)
      ensureDir(skillDir)

      // Copy source into skills/{name}/
      fs.cpSync(sourceDirectory, skillDir, { recursive: true })

      // Inject standard Claude plugin manifest
      writePluginManifest(destDir, id, name)

      const fileCount = countFilesRecursive(destDir)
      const now = Date.now()
      const skill = {
        id,
        name,
        scope,
        directory: destDir,
        sourceDirectory,
        fileCount,
        createdAt: now,
        updatedAt: now
      }

      results.push(skill)
    } catch (e) {
      errors.push({
        sourceDirectory,
        name: userProvidedName || (sourceDirectory ? path.basename(sourceDirectory) : ''),
        error: e?.message || 'unknown error'
      })
    }
  }

  // Persist all successful imports
  if (results.length > 0) {
    const store = readStore()
    writeStore({ skills: [...results, ...store.skills] })
  }

  return { skills: results, errors }
}

function register(eventCenter) {
  eventCenter.register('skills', {
    listSkills,
    uploadSkill,
    uploadSkills,
    scanSkillDirs,
    readSkillMd,
    updateSkill,
    deleteSkill,
    getPluginPath
  })
}

module.exports = {
  register,
  listSkills,
  uploadSkill,
  uploadSkills,
  scanSkillDirs,
  readSkillMd,
  updateSkill,
  deleteSkill,
  getPluginPath,
  getSkillById: (id) => {
    const store = readStore()
    return store.skills.find(s => s.id === id) || null
  }
}
