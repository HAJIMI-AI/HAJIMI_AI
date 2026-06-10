const { ipcMain, app, BrowserWindow, dialog, shell, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { pathToFileURL } = require('url')
const https = require('https')
const http = require('http')
const { execSync } = require('child_process')
const { loadUrlsConfig, loadSeededAppsConfig } = require('./config/index.cjs')

const openDevTools = (win, hsq) => {
  if (!win) return
  if (!win.webContents) return
  // Open devtools if global developer mode is on, or if hsq.config.json has "dev": true
  const devMode = readAppSettings().devMode === true
  if (!devMode && (!hsq || hsq.dev !== true)) return
  try {
    win.webContents.openDevTools()
  } catch {}
}


function randomId() {
  try {
    const crypto = require('crypto')
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function createErrorPayload(error) {
  if (!error) return { message: 'Unknown error' }
  if (typeof error === 'string') return { message: error }
  const payload = {
    name: error.name,
    message: error.message,
    stack: error.stack
  }
  if (error.code !== undefined) payload.code = error.code
  if (error.authInvalid === true) payload.authInvalid = true
  return payload
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function getBaseStoreDir() {
  const baseDir = app.getPath('userData')
  const dataDir = path.join(baseDir, 'store')
  ensureDir(dataDir)
  return dataDir
}

function getAppSettingsPath() {
  return path.join(getBaseStoreDir(), 'appSettings.json')
}

function readAppSettings() {
  const filePath = getAppSettingsPath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    const mqttByUserKey = parsed?.mqttByUserKey && typeof parsed.mqttByUserKey === 'object' ? parsed.mqttByUserKey : {}
    const profilesByUserKey =
      parsed?.profilesByUserKey && typeof parsed.profilesByUserKey === 'object' ? parsed.profilesByUserKey : {}
    const appsByUserKey = parsed?.appsByUserKey && typeof parsed.appsByUserKey === 'object' ? parsed.appsByUserKey : {}
    const appsStateByUserKey =
      parsed?.appsStateByUserKey && typeof parsed.appsStateByUserKey === 'object' ? parsed.appsStateByUserKey : {}
    const appStorageByUserKey =
      parsed?.appStorageByUserKey && typeof parsed.appStorageByUserKey === 'object' ? parsed.appStorageByUserKey : {}
    return {
      userKey: typeof parsed?.userKey === 'string' ? parsed.userKey : null,
      deviceCode: typeof parsed?.deviceCode === 'string' ? parsed.deviceCode : null,
      eventMode: typeof parsed?.eventMode === 'string' ? parsed.eventMode : 'ipc',
      devMode: parsed?.devMode === true,
      mqttByUserKey: {},
      setupByUserKey: {},
      profilesByUserKey,
      appsByUserKey,
      appsStateByUserKey,
      appStorageByUserKey,
      seededAppsByUserKey: parsed?.seededAppsByUserKey && typeof parsed.seededAppsByUserKey === 'object' ? parsed.seededAppsByUserKey : {}
    }
  } catch {
    return {
      userKey: null,
      deviceCode: null,
      eventMode: 'ipc',
      devMode: false,
      mqttByUserKey: {},
      setupByUserKey: {},
      profilesByUserKey: {},
      appsByUserKey: {},
      appsStateByUserKey: {},
      appStorageByUserKey: {},
      seededAppsByUserKey: {}
    }
  }
}

function writeAppSettings(next) {
  const filePath = getAppSettingsPath()
  const tmpPath = `${filePath}.${randomId()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function sanitizeUserKey(userKey) {
  const key = typeof userKey === 'string' ? userKey.trim() : ''
  if (!key) return null
  const ok = /^[a-zA-Z0-9_-]{3,64}$/.test(key)
  if (!ok) throw new Error('userKey must match /^[a-zA-Z0-9_-]{3,64}$/')
  return key
}

function getOrCreateDeviceCode() {
  const settings = readAppSettings()
  if (settings.deviceCode) return settings.deviceCode
  const next = {
    ...settings,
    deviceCode: `${os.hostname()}-${randomId()}`
  }
  writeAppSettings(next)
  return next.deviceCode
}

function getMqttPolicy() {
  try {
    const policy = require('./policy.cjs')
    const mqtt = policy?.mqtt && typeof policy.mqtt === 'object' ? policy.mqtt : {}
    const enabled = mqtt.enabled === true
    const disabledReason =
      typeof mqtt.disabledReason === 'string' && mqtt.disabledReason.trim()
        ? mqtt.disabledReason.trim()
        : 'MQTT 已禁用'
    return { enabled, disabledReason }
  } catch {
    return { enabled: true, disabledReason: '' }
  }
}

function normalizeManagedAppMode(mode) {
  const raw = typeof mode === 'string' ? mode.trim() : ''
  if (!raw) return null
  if (raw === 'local' || raw === '本地') return 'local'
  if (raw === 'remote' || raw === '远端') return 'remote'
  return null
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

function loadManagedAppFromDirectory(directory) {
  const dir = typeof directory === 'string' ? directory.trim() : ''
  if (!dir) throw new Error('directory is required')

  const stat = fs.statSync(dir)
  if (!stat.isDirectory()) throw new Error('directory must be a folder')

  const configPath = path.join(dir, 'hsq.config.json')
  if (!fs.existsSync(configPath)) throw new Error('hsq.config.json 不存在')

  const cfg = readJsonFile(configPath)
  const appIdRaw = cfg?.appId
  const appId = typeof appIdRaw === 'string' ? appIdRaw.trim() : ''
  const name = typeof cfg?.appName === 'string' ? cfg.appName.trim() : typeof cfg?.name === 'string' ? cfg.name.trim() : ''
  const version =
    typeof cfg?.appVersion === 'string' ? cfg.appVersion.trim() : typeof cfg?.version === 'string' ? cfg.version.trim() : ''
  const description =
    typeof cfg?.appDescription === 'string'
      ? cfg.appDescription.trim()
      : typeof cfg?.description === 'string'
        ? cfg.description.trim()
        : ''
  const gitUrl = typeof cfg?.git === 'string' ? cfg.git.trim() : typeof cfg?.gitUrl === 'string' ? cfg.gitUrl.trim() : ''
  const mode = normalizeManagedAppMode(cfg?.mode)
  const remoteUrl = typeof cfg?.remoteUrl === 'string' ? cfg.remoteUrl.trim() : typeof cfg?.url === 'string' ? cfg.url.trim() : ''
  const dev = cfg?.dev === true

  if (!appId) throw new Error('hsq.config.json: appId is required')
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(appId)) {
    throw new Error('hsq.config.json: appId must match /^[a-zA-Z0-9_-]{3,64}$/')
  }
  if (!name) throw new Error('hsq.config.json: appName is required')
  if (!version) throw new Error('hsq.config.json: appVersion is required')
  if (!description) throw new Error('hsq.config.json: appDescription is required')
  if (!mode) throw new Error('hsq.config.json: mode must be local|remote')

  const indexHtmlPath = path.join(dir, 'index.html')
  const hasIndexHtml = fs.existsSync(indexHtmlPath)
  if (mode === 'local' && !hasIndexHtml) throw new Error('本地模式必须存在 index.html')
  if (mode === 'remote' && !remoteUrl) throw new Error('远端模式必须存在 remoteUrl')

  return {
    directory: dir,
    configPath,
    hsq: {
      appId,
      appName: name,
      appVersion: version,
      appDescription: description,
      ...(gitUrl ? { gitUrl } : {}),
      mode,
      ...(remoteUrl ? { remoteUrl } : {}),
      hasIndexHtml,
      dev
    },
    indexHtmlPath: hasIndexHtml ? indexHtmlPath : null
  }
}

function normalizeAppId(appId) {
  const raw = typeof appId === 'string' ? appId.trim() : ''
  if (!raw) return null
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(raw)) {
    throw new Error('appId must match /^[a-zA-Z0-9_-]{3,64}$/')
  }
  return raw
}

function appendUrlSuffix(baseUrl, suffix) {
  const base = typeof baseUrl === 'string' ? baseUrl : ''
  const extra = typeof suffix === 'string' ? suffix.trim() : ''
  if (!extra) return base
  if (extra.startsWith('?') || extra.startsWith('#')) return `${base}${extra}`
  if (base.endsWith('/') || extra.startsWith('/')) return `${base}${extra}`
  return `${base}/${extra}`
}

/**
 * Load a remote URL into a BrowserWindow with cache-busting.
 *
 * Appends a `_t` timestamp query param so that the main HTML document is never
 * served from browser cache, and sends `Cache-Control: no-cache` headers so
 * that CDN / reverse-proxy layers revalidate every sub-resource (JS, CSS,
 * images, etc.).  This keeps URL-type apps (including built-in ones like
 * the app store) from showing stale pages.
 */
function loadUrlWithCacheBust(win, remoteUrl) {
  const sep = remoteUrl.includes('?') ? '&' : '?'
  const cacheBustUrl = `${remoteUrl}${sep}_t=${Date.now()}`
  return win.loadURL(cacheBustUrl, {
    extraHeaders: 'Cache-Control: no-cache, no-store, must-revalidate\nPragma: no-cache\n'
  })
}

async function readAppIcon(directory) {
  const iconNames = ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp']
  for (const name of iconNames) {
    const p = path.join(directory, name)
    if (!fs.existsSync(p)) continue
    try {
      const img = nativeImage.createFromPath(p)
      if (img.isEmpty()) continue
      const size = img.getSize()
      // Resize to fit within 256x256, preserving aspect ratio, no upscaling
      if (size.width > 256 || size.height > 256) {
        const ratio = Math.min(256 / size.width, 256 / size.height)
        img.resize({
          width: Math.round(size.width * ratio),
          height: Math.round(size.height * ratio),
          quality: 'best'
        })
      }
      const buf = img.toPNG()
      const b64 = buf.toString('base64')
      return `data:image/png;base64,${b64}`
    } catch {
      continue
    }
  }
  return null
}

// ---- Download & extract helpers ----

/** Download a file from url to destPath. Returns a promise. */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const req = proto.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`))
        return
      }
      const file = fs.createWriteStream(destPath)
      res.pipe(file)
      file.on('finish', () => { file.close(() => resolve()) })
      file.on('error', (e) => { try { fs.unlinkSync(destPath) } catch {}; reject(e) })
      res.on('error', (e) => { try { fs.unlinkSync(destPath) } catch {}; reject(e) })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')) })
    req.on('error', (e) => reject(e))
  })
}

/** Download a remote icon image and return a base64 data URL (PNG, max 256x256).
 *  Returns null if the icon cannot be fetched or processed. */
async function fetchRemoteIcon(iconUrl) {
  return new Promise((resolve) => {
    const proto = iconUrl.startsWith('https') ? https : http
    proto.get(iconUrl, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          const buf = Buffer.concat(chunks)
          const img = nativeImage.createFromBuffer(buf)
          if (img.isEmpty()) { resolve(null); return }
          const size = img.getSize()
          if (size.width > 256 || size.height > 256) {
            const ratio = Math.min(256 / size.width, 256 / size.height)
            img.resize({
              width: Math.round(size.width * ratio),
              height: Math.round(size.height * ratio),
              quality: 'best'
            })
          }
          const png = img.toPNG()
          resolve(`data:image/png;base64,${png.toString('base64')}`)
        } catch { resolve(null) }
      })
      res.on('error', () => resolve(null))
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null) })
  })
}

/** Cross-platform zip extraction using system tools. */
function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    execSync(`powershell.exe -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'ignore', shell: true })
  } else {
    // Use absolute path — packaged Electron has a restricted PATH
    execSync(`/usr/bin/unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'ignore' })
  }
}

/**
 * Fetch a remote hsq.config.json and validate it.
 * Returns the parsed config object on success, throws on failure.
 */
function fetchRemoteConfig(baseUrl) {
  return new Promise((resolve, reject) => {
    const configUrl = baseUrl.endsWith('/') ? `${baseUrl}hsq.config.json` : `${baseUrl}/hsq.config.json`
    const proto = configUrl.startsWith('https') ? https : http
    proto.get(configUrl, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchRemoteConfig(res.headers.location.replace(/\/hsq\.config\.json$/, '')).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Remote config not found: HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const cfg = JSON.parse(data)
          // Normalize URL for storage — use the base URL without hsq.config.json
          const normalizedUrl = baseUrl.replace(/\/+$/, '')
          const appId = cfg?.appId?.trim()
          const mode = normalizeManagedAppMode(cfg?.mode)
          if (!appId) { reject(new Error('Remote hsq.config.json: appId is required')); return }
          if (!/^[a-zA-Z0-9_-]{3,64}$/.test(appId)) {
            reject(new Error('Remote hsq.config.json: appId must match /^[a-zA-Z0-9_-]{3,64}$/'))
            return
          }
          if (!cfg?.appName && !cfg?.name) { reject(new Error('Remote hsq.config.json: appName is required')); return }
          resolve({
            appId,
            appName: (cfg.appName || cfg.name || '').trim(),
            appVersion: (cfg.appVersion || cfg.version || '0.0.0').trim(),
            appDescription: (cfg.appDescription || cfg.description || '').trim(),
            gitUrl: (cfg.git || cfg.gitUrl || '').trim() || undefined,
            mode: mode || 'remote',
            remoteUrl: normalizedUrl,
            hasIndexHtml: false,
            dev: cfg?.dev === true
          })
        } catch (e) {
          if (e instanceof SyntaxError) reject(new Error('Remote hsq.config.json is not valid JSON'))
          else reject(e)
        }
      })
      res.on('error', reject)
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('Request timeout')) })
  })
}

/** Find an existing app by hsq.appId. Returns the app item and its internal id, or null. */
function findExistingAppByAppId(settings, userKey, appId) {
  const byId =
    settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
      ? settings.appsByUserKey[userKey]
      : {}
  for (const [id, app] of Object.entries(byId)) {
    if (app && typeof app === 'object' && app?.hsq?.appId === appId) {
      return { id, app }
    }
  }
  return null
}

function resolvePathInside(baseDir, relativePath) {
  const base = typeof baseDir === 'string' ? baseDir : ''
  if (!base) throw new Error('baseDir is required')
  const rel = typeof relativePath === 'string' ? relativePath.trim() : ''
  if (!rel) throw new Error('path is required')
  if (path.isAbsolute(rel)) throw new Error('path must be relative')

  const baseResolved = path.resolve(base)
  const full = path.resolve(baseResolved, rel)
  const prefix = `${baseResolved}${path.sep}`
  if (full === baseResolved || full.startsWith(prefix)) return { baseResolved, full }
  throw new Error('path is outside app directory')
}

class EventCenter {
  constructor() {
    this._services = new Map()
    this._ipcRegistered = false
    this._mqtt = null
    this._refreshingToken = null
    this._appWindows = new Map()
    this._appWindowsByAppId = new Map()
    this._popupWindowsByAppId = new Map()
    this._appDataByWindowId = new Map()
    this._mainWindow = null
  }

  setMainWindow(win) {
    this._mainWindow = win
  }

  register(serviceName, methods) {
    if (!serviceName || typeof serviceName !== 'string') {
      throw new Error('serviceName must be a non-empty string')
    }
    if (!methods || typeof methods !== 'object') {
      throw new Error('methods must be an object')
    }
    this._services.set(serviceName, { ...methods })
  }

  registerModule(mod) {
    if (!mod) throw new Error('module is required')
    if (typeof mod.register === 'function') {
      mod.register(this)
      return
    }
    if (mod.name && mod.methods) {
      this.register(mod.name, mod.methods)
      return
    }
    throw new Error('module must export register(eventCenter) or { name, methods }')
  }

  listServices() {
    const result = {}
    for (const [name, methods] of this._services.entries()) {
      result[name] = Object.keys(methods).sort()
    }
    return result
  }

  async invoke(serviceName, methodName, args = [], context = {}) {
    const service = this._services.get(serviceName)
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`)
    }
    const fn = service[methodName]
    if (typeof fn !== 'function') {
      throw new Error(`Unknown method: ${serviceName}.${methodName}`)
    }
    try {
      const result = await fn(...args, context)
      return result
    } catch (error) {
      throw error
    }
  }

  setupIPC({ channel = 'eventCenter:invoke' } = {}) {
    if (this._ipcRegistered) return
    this._ipcRegistered = true

    ipcMain.handle(channel, async (event, payload) => {
      const id = payload?.id || randomId()
      const service = payload?.service || payload?.type
      const method = payload?.method
      const args = Array.isArray(payload?.args) ? payload.args : []

      if (!service || !method) {
        return {
          id,
          ok: false,
          error: { message: 'Invalid payload: missing service/type or method' }
        }
      }

      try {
        const result = await this.invoke(service, method, args, {
          mode: 'ipc',
          sender: event.sender
        })
        return { id, ok: true, result }
      } catch (error) {
        return { id, ok: false, error: createErrorPayload(error) }
      }
    })
  }

  async setupMQTT({
    url,
    username,
    password,
    options,
    topicPrefix,
    requestTopic = 'request',
    responseTopic = 'response'
  }) {
    const policy = getMqttPolicy()
    if (!policy.enabled) throw new Error(policy.disabledReason)
    if (!url) throw new Error('MQTT url is required')
    if (!topicPrefix || typeof topicPrefix !== 'string') throw new Error('topicPrefix is required')

    let mqtt
    try {
      mqtt = require('mqtt')
    } catch {
      throw new Error('MQTT mode requires installing the "mqtt" package')
    }

    const connectOptions = {
      ...(options || {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {})
    }

    if (this._mqtt?.client) {
      try {
        this._mqtt.client.end(true)
      } catch {}
      this._mqtt = null
    }

    const client = mqtt.connect(url, connectOptions)
    const requestFullTopic = `${topicPrefix}/${requestTopic}`
    const responseFullTopic = `${topicPrefix}/${responseTopic}`

    client.on('connect', () => {
      client.subscribe(requestFullTopic)
    })

    client.on('message', async (_topic, raw) => {
      const handledAt = Date.now()
      let msg
      try {
        msg = JSON.parse(raw.toString('utf8'))
      } catch (error) {
        const id = randomId()
        const deviceCode = getOrCreateDeviceCode()
        client.publish(
          responseFullTopic,
          JSON.stringify({
            id,
            ok: false,
            deviceCode,
            timestamp: handledAt,
            error: createErrorPayload(error)
          })
        )
        return
      }

      const id = msg?.id || randomId()
      const service = msg?.service || msg?.type
      const method = msg?.method
      const args = Array.isArray(msg?.args) ? msg.args : []
      const meta = {
        deviceCode: msg?.deviceCode || getOrCreateDeviceCode(),
        timestamp: typeof msg?.timestamp === 'number' ? msg.timestamp : handledAt,
        dialogueId: msg?.dialogueId,
        agentSessionId: msg?.agentSessionId,
        agentMessageId: msg?.agentMessageId
      }

      if (!service || !method) {
        client.publish(
          responseFullTopic,
          JSON.stringify({
            id,
            ok: false,
            ...meta,
            error: { message: 'Invalid payload: missing service/type or method' }
          })
        )
        return
      }

      try {
        const result = await this.invoke(service, method, args, {
          mode: 'mqtt',
          mqtt: { topicPrefix, requestFullTopic, responseFullTopic },
          meta
        })
        client.publish(responseFullTopic, JSON.stringify({ id, ok: true, result, ...meta }))
      } catch (error) {
        client.publish(
          responseFullTopic,
          JSON.stringify({ id, ok: false, error: createErrorPayload(error), ...meta })
        )
      }
    })

    this._mqtt = { client, url, username, password, topicPrefix, requestFullTopic, responseFullTopic }
  }

  dispose() {
    if (this._mqtt?.client) {
      try {
        this._mqtt.client.end(true)
      } catch {}
    }
    this._mqtt = null
  }

  getClientConfig() {
    const settings = readAppSettings()
    const userKey = settings.userKey
    const mqttPolicy = getMqttPolicy()
    const profile =
      userKey && settings.profilesByUserKey?.[userKey] && typeof settings.profilesByUserKey[userKey] === 'object'
        ? settings.profilesByUserKey[userKey]
        : null
    const userNickname = profile?.nickname || null
    const userAvatar = profile?.avatar || null
    return {
      userKey,
      userNickname,
      userAvatar,
      eventMode: settings.eventMode || 'ipc',
      deviceCode: getOrCreateDeviceCode(),
      mqtt: null,
      setupCompleted: true, // local profiles have no setup wizard
      mqttEnabled: mqttPolicy.enabled,
      mqttDisabledReason: mqttPolicy.disabledReason,
      devMode: settings.devMode === true
    }
  }

  setUserKey(userKey) {
    const nextUserKey = sanitizeUserKey(userKey)
    const settings = readAppSettings()
    const next = { ...settings, userKey: nextUserKey }
    writeAppSettings(next)
    return { userKey: nextUserKey }
  }

  setLocalProfile(input) {
    const settings = readAppSettings()
    const userKey = typeof input?.userKey === 'string' ? input.userKey.trim() : settings.userKey
    if (!userKey) throw new Error('userKey is required')

    const nickname = typeof input?.nickname === 'string' ? input.nickname.trim() : ''
    if (!nickname) throw new Error('nickname is required')

    const avatar = typeof input?.avatar === 'string' ? input.avatar.trim() : ''

    const profilesByUserKey = {
      ...(settings.profilesByUserKey && typeof settings.profilesByUserKey === 'object'
        ? settings.profilesByUserKey
        : {})
    }
    profilesByUserKey[userKey] = {
      nickname,
      avatar: avatar || null,
      updatedAt: Date.now()
    }

    writeAppSettings({ ...settings, profilesByUserKey })

    // Auto-set userKey if not already set
    if (!settings.userKey) {
      this.setUserKey(userKey)
      // Seed system apps for first-time profile creation, since app startup
      // ensureSeededApps ran before a userKey existed and was a no-op.
      this.invoke('apps', 'ensureSeededApps', []).catch(() => {})
    }

    return {
      userKey,
      nickname,
      avatar: avatar || null
    }
  }

  getLocalProfile(input) {
    const settings = readAppSettings()
    const userKey =
      typeof input === 'string'
        ? input.trim()
        : typeof input?.userKey === 'string'
          ? input.userKey.trim()
          : settings.userKey
    if (!userKey) throw new Error('userKey is required')

    const profilesByUserKey = settings.profilesByUserKey && typeof settings.profilesByUserKey === 'object'
      ? settings.profilesByUserKey
      : {}
    const profile =
      profilesByUserKey[userKey] && typeof profilesByUserKey[userKey] === 'object'
        ? profilesByUserKey[userKey]
        : null

    return {
      exists: !!profile,
      userKey,
      nickname: profile?.nickname || null,
      avatar: profile?.avatar || null
    }
  }

  listProfiles() {
    const settings = readAppSettings()
    const profilesByUserKey = settings.profilesByUserKey && typeof settings.profilesByUserKey === 'object'
      ? settings.profilesByUserKey
      : {}
    const profiles = Object.entries(profilesByUserKey)
      .filter(([, v]) => v && typeof v === 'object' && typeof v.nickname === 'string' && v.nickname.trim())
      .map(([key, v]) => ({
        userKey: key,
        nickname: v.nickname,
        avatar: v.avatar || null,
        updatedAt: v.updatedAt || null
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    return { profiles }
  }

  deleteProfile(input) {
    const settings = readAppSettings()
    const userKey =
      typeof input === 'string' ? input.trim() : typeof input?.userKey === 'string' ? input.userKey.trim() : ''
    if (!userKey) throw new Error('userKey is required')

    const profilesByUserKey = {
      ...(settings.profilesByUserKey && typeof settings.profilesByUserKey === 'object'
        ? settings.profilesByUserKey
        : {})
    }
    delete profilesByUserKey[userKey]
    writeAppSettings({ ...settings, profilesByUserKey })

    // If the deleted profile was the active user, sign out
    if (settings.userKey === userKey) {
      this.setUserKey('')
    }

    return { ok: true }
  }

  setMqttConfig(input) {
    const settings = readAppSettings()
    const userKey = settings.userKey
    if (!userKey) throw new Error('userKey is required')

    const url = typeof input?.url === 'string' ? input.url.trim() : ''
    if (!url) throw new Error('url is required')

    const username = typeof input?.username === 'string' ? input.username : undefined
    const password = typeof input?.password === 'string' ? input.password : undefined

    const mqttByUserKey = { ...(settings.mqttByUserKey || {}) }
    const prev = mqttByUserKey[userKey] && typeof mqttByUserKey[userKey] === 'object' ? mqttByUserKey[userKey] : {}
    mqttByUserKey[userKey] = {
      url,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(typeof prev.lastTestOk === 'boolean' ? { lastTestOk: prev.lastTestOk } : {}),
      ...(typeof prev.lastTestAt === 'number' ? { lastTestAt: prev.lastTestAt } : {})
    }

    const next = { ...settings, mqttByUserKey }
    writeAppSettings(next)

    const mode = next.eventMode || 'ipc'
    if (mode === 'mqtt' || mode === 'both') {
      this.setupMQTT({ url, username, password, topicPrefix: userKey })
    }

    return { mqtt: mqttByUserKey[userKey] }
  }

  async testMqttConnection(input) {
    const policy = getMqttPolicy()
    if (!policy.enabled) throw new Error(policy.disabledReason)
    const settings = readAppSettings()
    const userKey = settings.userKey
    if (!userKey) throw new Error('userKey is required')

    const url = typeof input?.url === 'string' ? input.url.trim() : ''
    if (!url) throw new Error('url is required')
    const username = typeof input?.username === 'string' ? input.username : undefined
    const password = typeof input?.password === 'string' ? input.password : undefined
    const timeoutMs = typeof input?.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : 6000

    let mqtt
    try {
      mqtt = require('mqtt')
    } catch {
      throw new Error('MQTT mode requires installing the "mqtt" package')
    }

    const startedAt = Date.now()

    const result = await new Promise((resolve) => {
      const client = mqtt.connect(url, {
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
        connectTimeout: timeoutMs,
        reconnectPeriod: 0
      })

      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        try {
          client.end(true)
        } catch {}
        resolve({ ok: false, error: 'timeout' })
      }, timeoutMs)

      client.on('connect', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          client.end(true)
        } catch {}
        resolve({ ok: true })
      })

      client.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          client.end(true)
        } catch {}
        resolve({ ok: false, error: err?.message || 'error' })
      })
    })

    const latencyMs = Date.now() - startedAt

    const mqttByUserKey = { ...(settings.mqttByUserKey || {}) }
    const prev = mqttByUserKey[userKey] && typeof mqttByUserKey[userKey] === 'object' ? mqttByUserKey[userKey] : {}
    mqttByUserKey[userKey] = {
      ...prev,
      url,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      lastTestOk: result.ok === true,
      lastTestAt: Date.now()
    }
    writeAppSettings({ ...settings, mqttByUserKey })

    return { ok: result.ok === true, latencyMs, error: result.ok ? null : result.error }
  }

  setEventMode(input) {
    const mode = typeof input?.mode === 'string' ? input.mode : ''
    if (!['ipc', 'mqtt', 'both'].includes(mode)) throw new Error('mode must be one of ipc|mqtt|both')

    const settings = readAppSettings()
    const next = { ...settings, eventMode: mode }
    writeAppSettings(next)

    if (mode === 'ipc') {
      this.dispose()
      return { eventMode: mode }
    }

    const policy = getMqttPolicy()
    if (!policy.enabled) throw new Error(policy.disabledReason)

    const userKey = next.userKey
    if (!userKey) throw new Error('userKey is required for mqtt/both mode')

    if (input?.mqtt && typeof input.mqtt === 'object') {
      this.setMqttConfig(input.mqtt)
    }

    const mqttCfg = readAppSettings().mqttByUserKey?.[userKey]
    if (!mqttCfg?.url) throw new Error('mqtt config is required for mqtt/both mode')

    this.setupMQTT({
      url: mqttCfg.url,
      username: mqttCfg.username,
      password: mqttCfg.password,
      topicPrefix: userKey
    })

    return { eventMode: mode }
  }

  registerControlPlane() {
    if (this._services.has('eventCenter')) return
    this.register('eventCenter', {
      listServices: () => this.listServices(),
      getClientConfig: () => this.getClientConfig(),
      hasUserKey: () => ({ hasUserKey: !!readAppSettings().userKey }),
      getUserKey: () => ({ userKey: readAppSettings().userKey }),
      setUserKey: (userKey) => this.setUserKey(userKey),
      getDeviceCode: () => ({ deviceCode: getOrCreateDeviceCode() }),
      getEventMode: () => ({ eventMode: readAppSettings().eventMode || 'ipc' }),
      // Developer mode — when enabled, all windows open DevTools automatically
      getDevMode: () => ({ devMode: readAppSettings().devMode === true }),
      setDevMode: (input) => {
        const enabled = input === true || (input && typeof input === 'object' && input.enabled === true)
        const settings = readAppSettings()
        writeAppSettings({ ...settings, devMode: enabled })
        // Immediately open or close DevTools on ALL existing windows
        for (const win of BrowserWindow.getAllWindows()) {
          if (win.isDestroyed()) continue
          try {
            if (enabled) {
              win.webContents.openDevTools()
            } else {
              win.webContents.closeDevTools()
            }
          } catch {}
        }
        return { devMode: enabled }
      },
      // Local profile management
      setLocalProfile: (input) => this.setLocalProfile(input),
      getLocalProfile: (input) => this.getLocalProfile(input),
      listProfiles: () => this.listProfiles(),
      deleteProfile: (input) => this.deleteProfile(input)
    })

    this.register('profile', {
      set: (input) => this.setLocalProfile(input),
      get: (input) => this.getLocalProfile(input),
      list: () => this.listProfiles(),
      delete: (input) => this.deleteProfile(input),
      // Switch to a profile (sign out current + sign in new)
      switchTo: (input) => {
        const targetUserKey =
          typeof input === 'string' ? input.trim() : typeof input?.userKey === 'string' ? input.userKey.trim() : ''
        if (!targetUserKey) throw new Error('userKey is required')

        const settings = readAppSettings()
        const profilesByUserKey = settings.profilesByUserKey && typeof settings.profilesByUserKey === 'object'
          ? settings.profilesByUserKey
          : {}
        const profile = profilesByUserKey[targetUserKey]
        if (!profile || typeof profile.nickname !== 'string' || !profile.nickname.trim()) {
          throw new Error('profile not found')
        }

        this.setUserKey(targetUserKey)

        // Seed system apps (self_shop etc.) for the new userKey — same as app startup
        this.invoke('apps', 'ensureSeededApps', []).catch(() => {})

        return { userKey: targetUserKey, nickname: profile.nickname, avatar: profile.avatar || null }
      },
      // Sign out (clear current userKey but keep profile data)
      signOut: () => {
        this.setUserKey('')
        return { ok: true }
      }
    })

    this.register('apps', {
      pickDirectory: async () => {
        const res = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory']
        })
        const dir = Array.isArray(res?.filePaths) && res.filePaths[0] ? res.filePaths[0] : ''
        return { directory: dir || null }
      },
      list: async (input) => {
        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')
        const appsByUserKey = settings.appsByUserKey || {}
        const byId = appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? appsByUserKey[userKey] : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        // Sort: self_shop always first, then pinned, then by updatedAt desc
        list.sort((a, b) => {
          const aIsShop = a?.hsq?.appId === 'self_shop'
          const bIsShop = b?.hsq?.appId === 'self_shop'
          if (aIsShop && !bIsShop) return -1
          if (!aIsShop && bIsShop) return 1
          const aPin = a?.pinned === true ? 1 : 0
          const bPin = b?.pinned === true ? 1 : 0
          if (aPin !== bPin) return bPin - aPin
          return (b?.updatedAt || 0) - (a?.updatedAt || 0)
        })

        // If reload is requested, re-parse hsq.config.json for each LOCAL app.
        // Remote apps are skipped — their config is fetched when the app is opened.
        if (input?.reload === true) {
          let changed = false
          const updated = await Promise.all(list.map(async (app) => {
            try {
              // Skip remote apps — directory is a URL, not a local path
              if (app?.hsq?.mode === 'remote') return app
              const reloaded = loadManagedAppFromDirectory(app.directory)
              const iconBase64 = await readAppIcon(app.directory)
              const next = {
                ...app,
                directory: reloaded.directory,
                indexHtmlPath: reloaded.indexHtmlPath,
                hsq: reloaded.hsq,
                ...(iconBase64 || app.iconBase64 ? { iconBase64: iconBase64 || app.iconBase64 } : {}),
                updatedAt: Date.now()
              }
              changed = true
              return next
            } catch {
              return app
            }
          }))
          if (changed) {
            const nextByUserKey = { ...appsByUserKey }
            const nextById = {}
            for (const a of updated) { nextById[a.id] = a }
            nextByUserKey[userKey] = nextById
            writeAppSettings({ ...settings, appsByUserKey: nextByUserKey })
          }
          return { apps: updated }
        }

        return { apps: list }
      },
      getByAppId: async (input) => {
        const appId = normalizeAppId(typeof input === 'string' ? input : input?.appId)
        if (!appId) throw new Error('appId is required')
        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const hit = list.find((x) => x?.hsq?.appId === appId) || null
        if (!hit) throw new Error('app not found')
        return { app: hit }
      },
      create: async (input) => {
        const alias = typeof input?.alias === 'string' ? input.alias.trim() : ''
        const directory = typeof input?.directory === 'string' ? input.directory.trim() : ''
        const overwrite = input?.overwrite === true
        if (!alias) throw new Error('alias is required')
        if (!directory) throw new Error('directory is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const loaded = loadManagedAppFromDirectory(directory)
        const iconBase64 = await readAppIcon(directory)

        // Check for duplicate appId
        const existing = findExistingAppByAppId(settings, userKey, loaded.hsq.appId)
        if (existing && !overwrite) {
          return { conflict: true, existingApp: existing.app }
        }

        const appsByUserKey = { ...(settings.appsByUserKey || {}) }
        const byId =
          appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}

        const now = Date.now()
        if (existing && overwrite) {
          // Update existing app in place
          byId[existing.id] = {
            ...existing.app,
            alias: alias || existing.app.alias,
            directory: loaded.directory,
            indexHtmlPath: loaded.indexHtmlPath,
            hsq: loaded.hsq,
            ...(iconBase64 ? { iconBase64 } : existing.app.iconBase64 ? { iconBase64: existing.app.iconBase64 } : {}),
            updatedAt: now
          }
          appsByUserKey[userKey] = byId
          writeAppSettings({ ...settings, appsByUserKey })
          return { app: byId[existing.id], updated: true }
        }

        const id = randomId()
        const appItem = {
          id,
          alias,
          directory: loaded.directory,
          indexHtmlPath: loaded.indexHtmlPath,
          hsq: loaded.hsq,
          ...(iconBase64 ? { iconBase64 } : {}),
          createdAt: now,
          updatedAt: now
        }

        byId[id] = appItem
        appsByUserKey[userKey] = byId
        writeAppSettings({ ...settings, appsByUserKey })
        return { app: appItem }
      },

      // Import an app by fingerprint — downloads zip from CDN, extracts, then uses local import logic.
      importByFingerprint: async (input) => {
        const fingerprint = typeof input?.fingerprint === 'string' ? input.fingerprint.trim() : ''
        const alias = typeof input?.alias === 'string' ? input.alias.trim() : ''
        const overwrite = input?.overwrite === true
        if (!fingerprint) throw new Error('fingerprint is required')
        if (!alias) throw new Error('alias is required')
        if (!/^[a-zA-Z0-9_-]{3,128}$/.test(fingerprint)) throw new Error('fingerprint format invalid')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const { cdnBase } = loadUrlsConfig()
        const zipUrl = `${cdnBase}/${fingerprint}.zip`
        const appDataDir = path.join(app.getPath('userData'), 'appData')
        const extractRoot = path.join(appDataDir, `_fingerprint_${fingerprint}_${Date.now()}`)
        const zipPath = path.join(appDataDir, `_download_${fingerprint}_${Date.now()}.zip`)

        try {
          // 1. Download
          await downloadFile(zipUrl, zipPath)

          // 2. Extract
          extractZip(zipPath, extractRoot)
          try { fs.unlinkSync(zipPath) } catch {}

          // 3. Find the actual app directory (zip may have a top-level folder)
          let appDir = extractRoot
          const entries = fs.readdirSync(extractRoot).filter(n => n !== '__MACOSX')
          if (entries.length === 1 && fs.statSync(path.join(extractRoot, entries[0])).isDirectory()) {
            appDir = path.join(extractRoot, entries[0])
          }

          // 4. Validate via local import logic
          const loaded = loadManagedAppFromDirectory(appDir)
          const iconBase64 = await readAppIcon(appDir)

          // Check for duplicate appId
          const existing = findExistingAppByAppId(settings, userKey, loaded.hsq.appId)
          if (existing && !overwrite) {
            // Keep the extracted directory for potential overwrite later
            return { conflict: true, existingApp: existing.app }
          }

          const appsByUserKey = { ...(settings.appsByUserKey || {}) }
          const byId =
            appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}

          const now = Date.now()
          if (existing && overwrite) {
            byId[existing.id] = {
              ...existing.app,
              alias: alias || existing.app.alias,
              directory: loaded.directory,
              indexHtmlPath: loaded.indexHtmlPath,
              hsq: loaded.hsq,
              ...(iconBase64 ? { iconBase64 } : existing.app.iconBase64 ? { iconBase64: existing.app.iconBase64 } : {}),
              updatedAt: now
            }
            appsByUserKey[userKey] = byId
            writeAppSettings({ ...settings, appsByUserKey })
            return { app: byId[existing.id], updated: true }
          }

          const id = randomId()
          const appItem = {
            id,
            alias,
            directory: loaded.directory,
            indexHtmlPath: loaded.indexHtmlPath,
            hsq: loaded.hsq,
            ...(iconBase64 ? { iconBase64 } : {}),
            createdAt: now,
            updatedAt: now
          }
          byId[id] = appItem
          appsByUserKey[userKey] = byId
          writeAppSettings({ ...settings, appsByUserKey })
          return { app: appItem }
        } catch (e) {
          // Clean up on failure
          try { fs.unlinkSync(zipPath) } catch {}
          try { fs.rmSync(extractRoot, { recursive: true, force: true }) } catch {}
          throw e
        }
      },

      // Import an app by remote URL — fetches URL/hsq.config.json and creates a remote-mode app.
      importByUrl: async (input) => {
        const url = typeof input?.url === 'string' ? input.url.trim() : ''
        const alias = typeof input?.alias === 'string' ? input.alias.trim() : ''
        const overwrite = input?.overwrite === true
        if (!url) throw new Error('url is required')
        if (!alias) throw new Error('alias is required')
        if (!/^https?:\/\/.+/.test(url)) throw new Error('url must start with http:// or https://')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        // Fetch and validate remote hsq.config.json
        const rawHsq = await fetchRemoteConfig(url)
        // Force remote mode — URL import always loads via loadURL
        const hsq = { ...rawHsq, mode: 'remote', remoteUrl: url.replace(/\/+$/, '') }
        const normalizedUrl = url.replace(/\/+$/, '')

        // Fetch remote icon (non-blocking — falls back to null if unavailable)
        const iconUrl = normalizedUrl.endsWith('/') ? `${normalizedUrl}icon.png` : `${normalizedUrl}/icon.png`
        const iconBase64 = await fetchRemoteIcon(iconUrl)

        // Check for duplicate appId
        const existing = findExistingAppByAppId(settings, userKey, hsq.appId)
        if (existing && !overwrite) {
          return { conflict: true, existingApp: existing.app }
        }

        const appsByUserKey = { ...(settings.appsByUserKey || {}) }
        const byId =
          appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}

        const now = Date.now()
        if (existing && overwrite) {
          byId[existing.id] = {
            ...existing.app,
            alias: alias || existing.app.alias,
            directory: normalizedUrl,
            indexHtmlPath: null,
            hsq,
            ...(iconBase64 ? { iconBase64 } : {}),
            updatedAt: now
          }
          appsByUserKey[userKey] = byId
          writeAppSettings({ ...settings, appsByUserKey })
          return { app: byId[existing.id], updated: true }
        }

        const id = randomId()
        const appItem = {
          id,
          alias,
          directory: normalizedUrl,
          indexHtmlPath: null,
          hsq,
          ...(iconBase64 ? { iconBase64 } : {}),
          createdAt: now,
          updatedAt: now
        }
        byId[id] = appItem
        appsByUserKey[userKey] = byId
        writeAppSettings({ ...settings, appsByUserKey })
        return { app: appItem }
      },

      update: async (input) => {
        const id = typeof input?.id === 'string' ? input.id.trim() : ''
        const alias = typeof input?.alias === 'string' ? input.alias.trim() : ''
        const directory = typeof input?.directory === 'string' ? input.directory.trim() : ''
        if (!id) throw new Error('id is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appsByUserKey = { ...(settings.appsByUserKey || {}) }
        const byId =
          appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}
        const prev = byId[id]
        if (!prev) throw new Error('app not found')

        const nextAlias = alias || prev.alias
        const updatedAt = Date.now()

        // Remote app update (directory IS a URL)
        if (typeof directory === 'string' && /^https?:\/\//.test(directory)) {
          const normalizedUrl = directory.replace(/\/+$/, '')
          const rawHsq = await fetchRemoteConfig(normalizedUrl)
          const hsq = { ...rawHsq, mode: 'remote', remoteUrl: normalizedUrl }
          const iconBase64 = await fetchRemoteIcon(`${normalizedUrl}/icon.png`)
          const next = {
            ...prev,
            alias: nextAlias,
            directory: normalizedUrl,
            indexHtmlPath: null,
            hsq,
            ...(iconBase64 ? { iconBase64 } : prev.iconBase64 ? { iconBase64: prev.iconBase64 } : {}),
            updatedAt
          }
          byId[id] = next
          appsByUserKey[userKey] = byId
          writeAppSettings({ ...settings, appsByUserKey })
          return { app: next }
        }

        // Local app update
        const nextDir = directory || prev.directory
        const loaded = directory ? loadManagedAppFromDirectory(nextDir) : null
        const iconBase64 = directory ? await readAppIcon(nextDir) : prev.iconBase64
        const next = {
          ...prev,
          alias: nextAlias,
          ...(loaded
            ? { directory: loaded.directory, indexHtmlPath: loaded.indexHtmlPath, hsq: loaded.hsq }
            : {}),
          ...(iconBase64 !== undefined ? { iconBase64 } : {}),
          updatedAt
        }
        byId[id] = next
        appsByUserKey[userKey] = byId
        writeAppSettings({ ...settings, appsByUserKey })
        return { app: next }
      },
      remove: async (input) => {
        const id = typeof input?.id === 'string' ? input.id.trim() : ''
        if (!id) throw new Error('id is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appsByUserKey = { ...(settings.appsByUserKey || {}) }
        const byId =
          appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}
        const app = byId[id]
        if (!app) throw new Error('app not found')

        // Protect system apps from deletion
        if (app?.hsq?.appId === 'self_shop') {
          throw new Error('该应用为系统内置，不可删除')
        }

        delete byId[id]
        appsByUserKey[userKey] = byId
        writeAppSettings({ ...settings, appsByUserKey })
        return { ok: true }
      },

      // Install system apps per user (idempotent — runs once per userKey).
      // Hardcoded — no network requests, instant.
      ensureSeededApps: () => {
        const settings = readAppSettings()

        const userKey = settings.userKey
        if (!userKey) return { ok: true, done: false }

        const seededAppsByUserKey = { ...(settings.seededAppsByUserKey || {}) }
        if (seededAppsByUserKey[userKey]) return { ok: true, done: false }

        const appsByUserKey = { ...(settings.appsByUserKey || {}) }
        const byId =
          appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}

        const seedConfigs = loadSeededAppsConfig()
        let addedAny = false

        for (const seed of seedConfigs) {
          const appId = typeof seed?.appId === 'string' ? seed.appId.trim() : ''
          if (!appId) continue
          const alreadyExists = Object.values(byId).some(
            (a) => a && typeof a === 'object' && a?.hsq?.appId === appId
          )
          if (alreadyExists) continue

          const remoteUrl = typeof seed?.url === 'string' ? seed.url.trim() : ''
          const iconPath = typeof seed?.iconPath === 'string' ? seed.iconPath : '/icon.png'
          const now = Date.now()
          const id = randomId()
          byId[id] = {
            id,
            alias: typeof seed?.name === 'string' ? seed.name : appId,
            directory: remoteUrl,
            indexHtmlPath: null,
            iconBase64: remoteUrl ? remoteUrl.replace(/\/+$/, '') + iconPath : null,
            hsq: {
              appId,
              appName: typeof seed?.name === 'string' ? seed.name : appId,
              appVersion: typeof seed?.version === 'string' ? seed.version : '1.0.0',
              appDescription: typeof seed?.description === 'string' ? seed.description : '',
              mode: seed?.mode === 'local' ? 'local' : 'remote',
              remoteUrl,
              dev: false
            },
            pinned: seed?.pinned === true,
            createdAt: now,
            updatedAt: now
          }
          addedAny = true
        }

        if (addedAny) {
          appsByUserKey[userKey] = byId
          seededAppsByUserKey[userKey] = true
          writeAppSettings({ ...settings, appsByUserKey, seededAppsByUserKey })
          return { ok: true, done: true }
        }

        seededAppsByUserKey[userKey] = true
        writeAppSettings({ ...settings, seededAppsByUserKey })
        return { ok: true, done: false }
      },

      // Return the set of internal app ids that currently have a running window.
      getRunning: async () => {
        const running = new Set()
        for (const appId of this._appWindowsByAppId.keys()) {
          const win = this._appWindowsByAppId.get(appId)
          if (win && !win.isDestroyed()) running.add(appId)
        }
        for (const appId of this._popupWindowsByAppId.keys()) {
          const win = this._popupWindowsByAppId.get(appId)
          if (win && !win.isDestroyed()) running.add(appId)
        }
        return { running: Array.from(running) }
      },

      // Toggle pinned status for an app.
      pin: async (input) => {
        const id = typeof input?.id === 'string' ? input.id.trim() : ''
        if (!id) throw new Error('id is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appsByUserKey = { ...(settings.appsByUserKey || {}) }
        const byId =
          appsByUserKey[userKey] && typeof appsByUserKey[userKey] === 'object' ? { ...appsByUserKey[userKey] } : {}
        const app = byId[id]
        if (!app) throw new Error('app not found')
        // self_shop is always pinned — cannot be unpinned
        if (app?.hsq?.appId === 'self_shop' && input?.pinned !== true) {
          throw new Error('应用商店不可取消置顶')
        }

        const pinned = input?.pinned === true
        byId[id] = { ...app, pinned, updatedAt: Date.now() }
        appsByUserKey[userKey] = byId
        writeAppSettings({ ...settings, appsByUserKey })
        return { ok: true, pinned }
      },

      getAppWorkdir: async (appId) => {
        const id = typeof appId === 'string' ? appId.trim() : ''
        if (!id) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appsStateByUserKey = { ...(settings.appsStateByUserKey || {}) }
        const byId = appsStateByUserKey[userKey] && typeof appsStateByUserKey[userKey] === 'object'
          ? appsStateByUserKey[userKey]
          : {}
        const state = byId?.[id] || {}

        // Default workdir: {userData}/appData/{appId}
        const defaultWorkdir = path.join(app.getPath('userData'), 'appData', id)
        const workdir = typeof state?.workdir === 'string' && state.workdir.trim()
          ? state.workdir.trim()
          : defaultWorkdir

        // Auto-create the default workdir
        ensureDir(workdir)

        return { workdir, isDefault: workdir === defaultWorkdir }
      },

      setAppWorkdir: async (input) => {
        const id = typeof input?.appId === 'string' ? input.appId.trim() : ''
        const directory = typeof input?.directory === 'string' ? input.directory.trim() : ''
        if (!id) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appsStateByUserKey = { ...(settings.appsStateByUserKey || {}) }
        const byId = appsStateByUserKey[userKey] && typeof appsStateByUserKey[userKey] === 'object'
          ? { ...appsStateByUserKey[userKey] }
          : {}

        if (directory) {
          // Set custom workdir (validate directory exists)
          if (!fs.existsSync(directory)) {
            throw new Error('directory does not exist: ' + directory)
          }
          byId[id] = { ...(byId[id] || {}), workdir: directory }
        } else {
          // Reset to default: remove custom workdir
          delete byId[id].workdir
        }

        appsStateByUserKey[userKey] = byId
        writeAppSettings({ ...settings, appsStateByUserKey })

        const defaultWorkdir = path.join(app.getPath('userData'), 'appData', id)
        const resolvedWorkdir = directory || defaultWorkdir
        ensureDir(resolvedWorkdir)
        return { workdir: resolvedWorkdir }
      },
      // Called by a child app to tell the main window to refresh its app list.
      refreshMainAppList: () => {
        const mainWin = this._mainWindow
        if (mainWin && !mainWin.isDestroyed()) {
          try { mainWin.webContents.send('apps:refresh-list') } catch {}
        }
        return { ok: true }
      },
      // Get the full app item for the current child window
      getCurrentAppItem: (context) => {
        const sender = context?.sender
        if (!sender) return null
        const win = BrowserWindow.fromWebContents(sender)
        if (!win || win.isDestroyed()) return null
        return this._appDataByWindowId?.get(String(win.id)) || null
      },
      open: async (input) => {
        const id = typeof input?.id === 'string' ? input.id.trim() : ''
        if (!id) throw new Error('id is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const appItem = byId?.[id]
        if (!appItem) throw new Error('app not found')

        const appId = typeof appItem?.hsq?.appId === 'string' ? appItem.hsq.appId.trim() : ''
        if (!appId) throw new Error('appId is required')

        const existing = this._appWindowsByAppId.get(appId) || this._popupWindowsByAppId.get(appId) || null
        if (existing && !existing.isDestroyed()) {
          if (existing.isMinimized()) {
            try { existing.restore() } catch {}
          }
          try { existing.show() } catch {}
          try { existing.focus() } catch {}
          // Remote apps: force reload to bust browser cache
          if (appItem?.hsq?.mode === 'remote') {
            try { existing.webContents.reloadIgnoringCache() } catch {}
          }
          return { ok: true, existed: true }
        }

        const title =
          (typeof appItem?.alias === 'string' && appItem.alias.trim() ? appItem.alias.trim() : '') ||
          (typeof appItem?.hsq?.appName === 'string' && appItem.hsq.appName.trim() ? appItem.hsq.appName.trim() : '')

        const win = new BrowserWindow({
          width: 1200,
          height: 800,
          title,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
            additionalArguments: [`--hsqAppId=${appId}`]
          }
        })

        const winId = String(win.id)
        this._appWindows.set(winId, win)
        this._appWindowsByAppId.set(appId, win)
        this._appDataByWindowId.set(winId, appItem)
        win.on('closed', () => {
          this._appWindows.delete(winId)
          this._appDataByWindowId.delete(winId)
          const latest = this._appWindowsByAppId.get(appId)
          if (latest === win) this._appWindowsByAppId.delete(appId)

        })

        const mode = appItem?.hsq?.mode
        openDevTools(win, appItem.hsq)
        if (mode === 'local') {
          const p = typeof appItem?.indexHtmlPath === 'string' ? appItem.indexHtmlPath : ''
          if (!p || !fs.existsSync(p)) throw new Error('index.html 不存在')
          await win.loadFile(p)
          return { ok: true }
        }

        const remoteUrl = typeof appItem?.hsq?.remoteUrl === 'string' ? appItem.hsq.remoteUrl.trim() : ''
        if (!remoteUrl) throw new Error('remoteUrl is required')
        await loadUrlWithCacheBust(win, remoteUrl)
        return { ok: true }
      },
      openPopup: async (input, context) => {
        const appId = normalizeAppId(typeof input === 'string' ? input : input?.appId)
        const suffix =
          typeof input?.pathSuffix === 'string'
            ? input.pathSuffix
            : typeof input?.path === 'string'
              ? input.path
              : ''
        const attachParent = input?.attachParent !== false
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const parentWin = attachParent && context?.sender ? BrowserWindow.fromWebContents(context.sender) : null

        const title =
          (typeof appItem?.alias === 'string' && appItem.alias.trim() ? appItem.alias.trim() : '') ||
          (typeof appItem?.hsq?.appName === 'string' && appItem.hsq.appName.trim() ? appItem.hsq.appName.trim() : '')

        let baseUrl = ''
        const mode = appItem?.hsq?.mode
        if (mode === 'local') {
          const p = typeof appItem?.indexHtmlPath === 'string' ? appItem.indexHtmlPath : ''
          if (!p || !fs.existsSync(p)) throw new Error('index.html 不存在')
          baseUrl = pathToFileURL(p).toString()
        } else {
          const remoteUrl = typeof appItem?.hsq?.remoteUrl === 'string' ? appItem.hsq.remoteUrl.trim() : ''
          if (!remoteUrl) throw new Error('remoteUrl is required')
          baseUrl = remoteUrl
        }

        const fullUrl = appendUrlSuffix(baseUrl, suffix)

        const win = new BrowserWindow({
          width: 1000,
          height: 700,
          title,
          ...(parentWin ? { parent: parentWin } : {}),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
            additionalArguments: [`--hsqAppId=${appId}`]
          }
        })

        const winId = String(win.id)
        this._appWindows.set(winId, win)
        this._appDataByWindowId.set(winId, appItem)
        win.on('closed', () => {
          this._appWindows.delete(winId)
          this._appDataByWindowId.delete(winId)
          const latest = this._popupWindowsByAppId.get(appId)
          if (latest === win) this._popupWindowsByAppId.delete(appId)

        })
        openDevTools(win, appItem.hsq)
        if (mode !== 'local') {
          await loadUrlWithCacheBust(win, fullUrl)
        } else {
          await win.loadURL(fullUrl)
        }
        return { ok: true, winId }
      },
      focusOrOpenPopup: async (input, context) => {
        const appId = normalizeAppId(typeof input === 'string' ? input : input?.appId)
        if (!appId) throw new Error('appId is required')

        // Check if a popup or main window is already open for this appId
        const existing = this._popupWindowsByAppId.get(appId) || this._appWindowsByAppId.get(appId) || null
        if (existing && !existing.isDestroyed()) {
          if (existing.isMinimized()) existing.restore()
          existing.show()
          existing.focus()
          // Force full cache-bust reload for remote apps so CDN updates are reflected
          const existingWinId = String(existing.id)
          const existingAppItem = this._appDataByWindowId.get(existingWinId)
          if (existingAppItem?.hsq?.mode === 'remote') {
            try { existing.webContents.reloadIgnoringCache() } catch {}
          }
          return { ok: true, winId: String(existing.id), existing: true }
        }

        // Open a new popup — reuse openPopup logic
        const suffix =
          typeof input?.pathSuffix === 'string'
            ? input.pathSuffix
            : typeof input?.path === 'string'
              ? input.path
              : ''
        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const title =
          (typeof appItem?.alias === 'string' && appItem.alias.trim() ? appItem.alias.trim() : '') ||
          (typeof appItem?.hsq?.appName === 'string' && appItem.hsq.appName.trim() ? appItem.hsq.appName.trim() : '')

        let baseUrl = ''
        const mode = appItem?.hsq?.mode
        if (mode === 'local') {
          const p = typeof appItem?.indexHtmlPath === 'string' ? appItem.indexHtmlPath : ''
          if (!p || !fs.existsSync(p)) throw new Error('index.html 不存在')
          baseUrl = pathToFileURL(p).toString()
        } else {
          const remoteUrl = typeof appItem?.hsq?.remoteUrl === 'string' ? appItem.hsq.remoteUrl.trim() : ''
          if (!remoteUrl) throw new Error('remoteUrl is required')
          baseUrl = remoteUrl
        }

        const sep = baseUrl.includes('?') ? '&' : '?'
        const fullUrl = suffix ? (suffix.startsWith('?') || suffix.startsWith('#') ? `${baseUrl}${suffix}` : `${baseUrl}${sep}${suffix}`) : baseUrl

        const win = new BrowserWindow({
          width: 900,
          height: 700,
          title,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
            additionalArguments: [`--hsqAppId=${appId}`]
          }
        })

        const winId = String(win.id)
        this._popupWindowsByAppId.set(appId, win)
        this._appDataByWindowId.set(winId, appItem)
        win.on('closed', () => {
          this._appDataByWindowId.delete(winId)
          const latest = this._popupWindowsByAppId.get(appId)
          if (latest === win) this._popupWindowsByAppId.delete(appId)

        })
        openDevTools(win, appItem.hsq)
        if (mode !== 'local') {
          await loadUrlWithCacheBust(win, fullUrl)
        } else {
          await win.loadURL(fullUrl)
        }
        return { ok: true, winId, existing: false }
      },
      replaceWithPopup: async (input, context) => {
        const rawInput = typeof input === 'string' ? { appId: input } : input || {}
        const res = await this.invoke('apps', 'openPopup', [{ ...rawInput, attachParent: false }], context)
        try {
          const currentWin = context?.sender ? BrowserWindow.fromWebContents(context.sender) : null
          if (currentWin && !currentWin.isDestroyed()) currentWin.close()
        } catch {}
        return res
      },
      closeCurrentWindow: async (_input, context) => {
        const currentWin = context?.sender ? BrowserWindow.fromWebContents(context.sender) : null
        if (!currentWin) throw new Error('current window not found')
        if (currentWin.isDestroyed()) return { ok: true, closed: false }
        try {
          currentWin.close()
        } catch {}
        return { ok: true, closed: true }
      },

      // Cross-window event communication
      sendAppEvent: async (input, context) => {
        const targetAppId = normalizeAppId(
          typeof input === 'string' ? input : input?.targetAppId
        )
        if (!targetAppId) throw new Error('targetAppId is required')

        const eventName =
          typeof input === 'string' ? undefined : typeof input?.eventName === 'string' ? input.eventName.trim() : ''
        if (!eventName) throw new Error('eventName is required')

        // Resolve sourceAppId from sender's window
        let sourceAppId = null
        if (typeof input === 'object' && input?.sourceAppId && typeof input.sourceAppId === 'string') {
          sourceAppId = input.sourceAppId.trim() || null
        }
        if (!sourceAppId && context?.sender) {
          const senderWin = BrowserWindow.fromWebContents(context.sender)
          if (senderWin && !senderWin.isDestroyed()) {
            for (const [id, w] of this._appWindowsByAppId) {
              if (w === senderWin) { sourceAppId = id; break }
            }
            if (!sourceAppId) {
              for (const [id, w] of this._popupWindowsByAppId) {
                if (w === senderWin) { sourceAppId = id; break }
              }
            }
          }
        }

        const data = typeof input === 'object' ? input?.data : undefined

        const payload = {
          sourceAppId: sourceAppId || null,
          eventName,
          data,
          timestamp: Date.now()
        }

        // Try main window first, then popup
        let targetWin = this._appWindowsByAppId.get(targetAppId) || null
        if (!targetWin || targetWin.isDestroyed()) {
          targetWin = this._popupWindowsByAppId.get(targetAppId) || null
        }
        if (!targetWin || targetWin.isDestroyed()) {
          throw new Error(`Target app window not found for appId: ${targetAppId}`)
        }

        targetWin.webContents.send('appEvent:message', payload)
        return { ok: true }
      },

      broadcastAppEvent: async (input, context) => {
        const eventName =
          typeof input === 'object' && typeof input?.eventName === 'string' ? input.eventName.trim() : ''
        if (!eventName) throw new Error('eventName is required')

        // Resolve sourceAppId from sender's window
        let sourceAppId = null
        if (typeof input === 'object' && input?.sourceAppId && typeof input.sourceAppId === 'string') {
          sourceAppId = input.sourceAppId.trim() || null
        }
        if (!sourceAppId && context?.sender) {
          const senderWin = BrowserWindow.fromWebContents(context.sender)
          if (senderWin && !senderWin.isDestroyed()) {
            for (const [id, w] of this._appWindowsByAppId) {
              if (w === senderWin) { sourceAppId = id; break }
            }
            if (!sourceAppId) {
              for (const [id, w] of this._popupWindowsByAppId) {
                if (w === senderWin) { sourceAppId = id; break }
              }
            }
          }
        }

        const data = typeof input === 'object' ? input?.data : undefined

        const payload = {
          sourceAppId: sourceAppId || null,
          eventName,
          data,
          timestamp: Date.now()
        }

        let sent = 0
        // Cover ALL windows: app windows, popups, main window, tray, preview, etc.
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win || win.isDestroyed()) continue
          try {
            win.webContents.send('appEvent:message', payload)
            sent++
          } catch {
            // ignore send failures
          }
        }

        return { ok: true, sent }
      }
    })

    this.register('appStorage', {
      get: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const key = typeof input?.key === 'string' ? input.key : ''
        if (!appId) throw new Error('appId is required')
        if (!key) throw new Error('key is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byUser = settings.appStorageByUserKey?.[userKey] && typeof settings.appStorageByUserKey[userKey] === 'object'
          ? settings.appStorageByUserKey[userKey]
          : {}
        const byApp = byUser?.[appId] && typeof byUser[appId] === 'object' ? byUser[appId] : {}
        const exists = Object.prototype.hasOwnProperty.call(byApp, key)
        const value = exists ? byApp[key] : null
        return { exists, value }
      },
      set: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const key = typeof input?.key === 'string' ? input.key : ''
        if (!appId) throw new Error('appId is required')
        if (!key) throw new Error('key is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appStorageByUserKey = { ...(settings.appStorageByUserKey || {}) }
        const byUser = appStorageByUserKey[userKey] && typeof appStorageByUserKey[userKey] === 'object'
          ? { ...appStorageByUserKey[userKey] }
          : {}
        const byApp = byUser[appId] && typeof byUser[appId] === 'object' ? { ...byUser[appId] } : {}
        byApp[key] = input?.value
        byUser[appId] = byApp
        appStorageByUserKey[userKey] = byUser
        writeAppSettings({ ...settings, appStorageByUserKey })
        return { ok: true }
      },
      remove: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const key = typeof input?.key === 'string' ? input.key : ''
        if (!appId) throw new Error('appId is required')
        if (!key) throw new Error('key is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const appStorageByUserKey = { ...(settings.appStorageByUserKey || {}) }
        const byUser = appStorageByUserKey[userKey] && typeof appStorageByUserKey[userKey] === 'object'
          ? { ...appStorageByUserKey[userKey] }
          : {}
        const byApp = byUser[appId] && typeof byUser[appId] === 'object' ? { ...byUser[appId] } : {}
        delete byApp[key]
        byUser[appId] = byApp
        appStorageByUserKey[userKey] = byUser
        writeAppSettings({ ...settings, appStorageByUserKey })
        return { ok: true }
      },
      list: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const prefix = typeof input?.prefix === 'string' ? input.prefix : ''
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byUser = settings.appStorageByUserKey?.[userKey] && typeof settings.appStorageByUserKey[userKey] === 'object'
          ? settings.appStorageByUserKey[userKey]
          : {}
        const byApp = byUser?.[appId] && typeof byUser[appId] === 'object' ? byUser[appId] : {}
        const keys = Object.keys(byApp).filter((k) => (prefix ? k.startsWith(prefix) : true)).sort()
        const items = keys.map((k) => ({ key: k, value: byApp[k] }))
        return { items }
      }
    })

    this.register('files', {
      writeText: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const filePath = typeof input?.path === 'string' ? input.path : ''
        const content = typeof input?.content === 'string' ? input.content : ''
        const encoding = typeof input?.encoding === 'string' && input.encoding ? input.encoding : 'utf8'
        const overwrite = input?.overwrite !== false
        const mkdirp = input?.mkdirp !== false
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const { full } = resolvePathInside(appItem.directory, filePath)
        const parentDir = path.dirname(full)
        if (mkdirp) ensureDir(parentDir)
        if (!overwrite && fs.existsSync(full)) throw new Error('file already exists')
        fs.writeFileSync(full, content, encoding)
        return { ok: true, path: full }
      },
      readText: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const filePath = typeof input?.path === 'string' ? input.path : ''
        const encoding = typeof input?.encoding === 'string' && input.encoding ? input.encoding : 'utf8'
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const { full } = resolvePathInside(appItem.directory, filePath)
        if (!fs.existsSync(full)) throw new Error('file not found')
        const content = fs.readFileSync(full, encoding)
        return { ok: true, path: full, content }
      },
      delete: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const filePath = typeof input?.path === 'string' ? input.path : ''
        const recursive = input?.recursive === true
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const { full } = resolvePathInside(appItem.directory, filePath)
        if (!fs.existsSync(full)) return { ok: true, deleted: false }
        const stat = fs.statSync(full)
        if (stat.isDirectory()) {
          if (!recursive) throw new Error('path is a directory; set recursive=true to delete')
          fs.rmSync(full, { recursive: true, force: true })
        } else {
          fs.unlinkSync(full)
        }
        return { ok: true, deleted: true }
      },
      copy: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const fromPath = typeof input?.from === 'string' ? input.from : ''
        const toPath = typeof input?.to === 'string' ? input.to : ''
        const overwrite = input?.overwrite !== false
        const mkdirp = input?.mkdirp !== false
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const { full: fromFull } = resolvePathInside(appItem.directory, fromPath)
        const { full: toFull } = resolvePathInside(appItem.directory, toPath)
        if (!fs.existsSync(fromFull)) throw new Error('source not found')
        if (!overwrite && fs.existsSync(toFull)) throw new Error('target already exists')
        if (mkdirp) ensureDir(path.dirname(toFull))
        fs.copyFileSync(fromFull, toFull)
        return { ok: true, from: fromFull, to: toFull }
      },
      move: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const fromPath = typeof input?.from === 'string' ? input.from : ''
        const toPath = typeof input?.to === 'string' ? input.to : ''
        const overwrite = input?.overwrite !== false
        const mkdirp = input?.mkdirp !== false
        if (!appId) throw new Error('appId is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const { full: fromFull } = resolvePathInside(appItem.directory, fromPath)
        const { full: toFull } = resolvePathInside(appItem.directory, toPath)
        if (!fs.existsSync(fromFull)) throw new Error('source not found')
        if (!overwrite && fs.existsSync(toFull)) throw new Error('target already exists')
        if (mkdirp) ensureDir(path.dirname(toFull))
        if (overwrite && fs.existsSync(toFull)) {
          const stat = fs.statSync(toFull)
          if (stat.isDirectory()) fs.rmSync(toFull, { recursive: true, force: true })
          else fs.unlinkSync(toFull)
        }
        fs.renameSync(fromFull, toFull)
        return { ok: true, from: fromFull, to: toFull }
      },

      pickFiles: async (input) => {
        const filters = Array.isArray(input?.filters) && input.filters.length > 0
          ? input.filters
          : [{ name: 'All Files', extensions: ['*'] }]
        const multi = input?.multi !== false
        const res = await dialog.showOpenDialog({
          properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
          filters
        })
        const files = Array.isArray(res?.filePaths) ? res.filePaths : []
        return { files }
      },

      readAbsoluteText: async (input) => {
        const filePath = typeof input?.path === 'string' ? input.path : ''
        const encoding = typeof input?.encoding === 'string' && input.encoding ? input.encoding : 'utf8'
        if (!filePath) throw new Error('path is required')
        if (!fs.existsSync(filePath)) throw new Error('file not found')
        const content = fs.readFileSync(filePath, encoding)
        const stat = fs.statSync(filePath)
        return {
          ok: true,
          path: filePath,
          content,
          size: stat.size,
          name: path.basename(filePath),
          ext: path.extname(filePath)
        }
      },

      pickWorkingDirectory: async () => {
        const res = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory']
        })
        const dir = Array.isArray(res?.filePaths) && res.filePaths[0] ? res.filePaths[0] : ''
        return { directory: dir || null }
      },

      // Reveal a file in the system file manager (Finder / Explorer)
      showItemInFolder: async (input) => {
        const filePath = typeof input?.path === 'string' ? input.path : ''
        if (!filePath) throw new Error('path is required')
        if (!fs.existsSync(filePath)) throw new Error('file not found')
        shell.showItemInFolder(filePath)
        return { ok: true }
      },

      // Auto-detect file type and return preview-ready content.
      // Images → base64 data URL with dimensions
      // Text/code → content string with language hint
      // Binary → type='binary', no content
      previewFile: async (input) => {
        const filePath = typeof input?.path === 'string' ? input.path : ''
        const maxTextBytes = typeof input?.maxTextBytes === 'number' && input.maxTextBytes > 0
          ? Math.min(input.maxTextBytes, 2 * 1024 * 1024)  // cap at 2MB
          : 512 * 1024  // default 512KB

        if (!filePath) throw new Error('path is required')
        if (!fs.existsSync(filePath)) throw new Error('file not found')

        const stat = fs.statSync(filePath)
        const name = path.basename(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const sizeBytes = stat.size

        // --- Image types ---
        const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']
        if (imageExts.includes(ext)) {
          const MAX_IMG = 20 * 1024 * 1024
          if (sizeBytes > MAX_IMG) throw new Error(`image too large: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB (max 20 MB)`)

          if (ext === '.svg') {
            const svgText = fs.readFileSync(filePath, 'utf8')
            const b64 = Buffer.from(svgText, 'utf8').toString('base64')
            return {
              type: 'image', path: filePath, name, ext, sizeBytes,
              base64: `data:image/svg+xml;base64,${b64}`,
              mimeType: 'image/svg+xml', width: 0, height: 0
            }
          }

          const img = nativeImage.createFromPath(filePath)
          if (img.isEmpty()) throw new Error('Failed to load image')
          const size = img.getSize()
          let w = size.width
          let h = size.height
          const maxDim = typeof input?.maxImageDim === 'number' && input.maxImageDim > 0 ? input.maxImageDim : 0

          if (maxDim && (w > maxDim || h > maxDim)) {
            const ratio = Math.min(maxDim / w, maxDim / h)
            w = Math.round(w * ratio)
            h = Math.round(h * ratio)
            img.resize({ width: w, height: h, quality: 'best' })
          }

          // nativeImage has no WebP encoder — .webp sources fall back to PNG output
          let buf, mime
          if (ext === '.png' || ext === '.webp') {
            buf = img.toPNG()
            mime = 'image/png'
          } else {
            buf = img.toJPEG(85)
            mime = 'image/jpeg'
          }
          return {
            type: 'image', path: filePath, name, ext, sizeBytes,
            base64: `data:${mime};base64,${buf.toString('base64')}`,
            mimeType: mime, width: w, height: h
          }
        }

        // --- Text / code types ---
        const textExts = new Set([
          '.txt', '.md', '.markdown', '.json', '.jsonc', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
          '.css', '.scss', '.less', '.html', '.htm', '.xml', '.svg',
          '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env', '.gitignore',
          '.py', '.rs', '.go', '.java', '.rb', '.php', '.c', '.cpp', '.h', '.hpp',
          '.sh', '.bash', '.zsh', '.fish', '.bat', '.ps1',
          '.sql', '.graphql', '.gql', '.prisma',
          '.vue', '.svelte', '.astro',
          '.log', '.csv', '.tsv', '.diff', '.patch',
          '.dockerfile', '.makefile', '.cmake'
        ])
        const isTextExt = textExts.has(ext) || textExts.has(name.toLowerCase())

        // Binary detection: check for null bytes in first 8KB
        if (!isTextExt && sizeBytes > 0) {
          const fd = fs.openSync(filePath, 'r')
          const probe = Buffer.alloc(Math.min(8192, sizeBytes))
          fs.readSync(fd, probe, 0, probe.length, 0)
          fs.closeSync(fd)
          const hasNull = probe.includes(0)
          if (hasNull) {
            return { type: 'binary', path: filePath, name, ext, sizeBytes }
          }
        }

        // Read as text (capped)
        const readSize = Math.min(maxTextBytes, sizeBytes)
        const buf = Buffer.alloc(readSize)
        const fd = fs.openSync(filePath, 'r')
        fs.readSync(fd, buf, 0, readSize, 0)
        fs.closeSync(fd)
        const content = buf.toString('utf8')
        const truncated = readSize < sizeBytes

        // Language detection from extension
        const langMap = {
          '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
          '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
          '.json': 'json', '.jsonc': 'json',
          '.md': 'markdown', '.markdown': 'markdown',
          '.css': 'css', '.scss': 'scss', '.less': 'less',
          '.html': 'html', '.htm': 'html', '.xml': 'xml', '.svg': 'xml',
          '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
          '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
          '.rb': 'ruby', '.php': 'php', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
          '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.bat': 'batch', '.ps1': 'powershell',
          '.sql': 'sql', '.graphql': 'graphql', '.gql': 'graphql',
          '.vue': 'html', '.svelte': 'html', '.astro': 'html',
          '.env': 'plaintext', '.gitignore': 'plaintext',
          '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
          '.dockerfile': 'dockerfile', '.makefile': 'makefile',
          '.diff': 'diff', '.patch': 'diff',
          '.log': 'plaintext', '.txt': 'plaintext'
        }
        const language = langMap[ext] || langMap[name.toLowerCase()] || 'plaintext'

        return {
          type: 'text', path: filePath, name, ext, sizeBytes,
          content, language, truncated
        }
      },

      // Read a local image file and return as base64 data URL.
      // Supports PNG / JPG / WebP / GIF / SVG / BMP.
      // Optional resize via maxWidth / maxHeight (aspect-ratio preserved).
      readImageAsBase64: async (input) => {
        const filePath = typeof input?.path === 'string' ? input.path : ''
        if (!filePath) throw new Error('path is required')

        const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
        const stat = fs.statSync(filePath)
        if (stat.size > MAX_SIZE) throw new Error(`image too large: ${(stat.size / 1024 / 1024).toFixed(1)} MB (max 20 MB)`)
        if (!fs.existsSync(filePath)) throw new Error('file not found')

        const ext = path.extname(filePath).toLowerCase()
        const svgExtensions = ['.svg']
        const supported = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']
        if (!supported.includes(ext)) {
          throw new Error(`unsupported image format: ${ext}. Supported: ${supported.join(', ')}`)
        }

        // SVG: read as text, return as data:image/svg+xml;base64
        if (svgExtensions.includes(ext)) {
          const svgText = fs.readFileSync(filePath, 'utf8')
          const b64 = Buffer.from(svgText, 'utf8').toString('base64')
          const dataUrl = `data:image/svg+xml;base64,${b64}`
          return { ok: true, path: filePath, base64: dataUrl, mimeType: 'image/svg+xml', width: 0, height: 0, sizeBytes: stat.size }
        }

        const maxWidth = typeof input?.maxWidth === 'number' && input.maxWidth > 0 ? Math.round(input.maxWidth) : 0
        const maxHeight = typeof input?.maxHeight === 'number' && input.maxHeight > 0 ? Math.round(input.maxHeight) : 0
        const quality = typeof input?.quality === 'number' && input.quality >= 0 && input.quality <= 1 ? input.quality : undefined
        const outputFormat = ext === '.png' ? 'png' : ext === '.webp' ? 'webp' : 'jpeg'

        const img = nativeImage.createFromPath(filePath)
        if (img.isEmpty()) throw new Error('Failed to load image')
        const size = img.getSize()
        let w = size.width
        let h = size.height

        // Resize if needed (preserve aspect ratio)
        if ((maxWidth && w > maxWidth) || (maxHeight && h > maxHeight)) {
          const rw = maxWidth ? maxWidth / w : 1
          const rh = maxHeight ? maxHeight / h : 1
          const ratio = Math.min(rw, rh)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
          img.resize({ width: w, height: h, quality: 'best' })
        }

        let outBuf, mimeType
        if (outputFormat === 'jpeg') {
          const jpegQuality = typeof quality === 'number' ? Math.round(quality * 100) : 85
          outBuf = img.toJPEG(jpegQuality)
          mimeType = 'image/jpeg'
        } else {
          // PNG or WebP fallback (nativeImage has no WebP encoder)
          outBuf = img.toPNG()
          mimeType = 'image/png'
        }
        const b64 = outBuf.toString('base64')
        const dataUrl = `data:${mimeType};base64,${b64}`

        return {
          ok: true,
          path: filePath,
          base64: dataUrl,
          mimeType,
          width: w,
          height: h,
          sizeBytes: outBuf.length
        }
      },

      // Write base64 image data to app directory (same safety constraints as writeTextFile).
      writeImageBase64: async (input) => {
        const appId = normalizeAppId(input?.appId)
        const relPath = typeof input?.path === 'string' ? input.path : ''
        const base64 = typeof input?.base64 === 'string' ? input.base64 : ''
        const overwrite = input?.overwrite !== false
        const mkdirp = input?.mkdirp !== false
        if (!appId) throw new Error('appId is required')
        if (!relPath) throw new Error('path is required')
        if (!base64) throw new Error('base64 is required')

        const settings = readAppSettings()
        const userKey = settings.userKey
        if (!userKey) throw new Error('userKey is required')

        const byId =
          settings.appsByUserKey?.[userKey] && typeof settings.appsByUserKey[userKey] === 'object'
            ? settings.appsByUserKey[userKey]
            : {}
        const list = Object.values(byId).filter((x) => x && typeof x === 'object')
        const appItem = list.find((x) => x?.hsq?.appId === appId) || null
        if (!appItem) throw new Error('app not found')

        const { full } = resolvePathInside(appItem.directory, relPath)
        const parentDir = path.dirname(full)
        if (mkdirp) ensureDir(parentDir)
        if (!overwrite && fs.existsSync(full)) throw new Error('file already exists')

        // Parse base64: support both "data:image/png;base64,xxx" and raw base64
        let buf
        const dataUrlMatch = base64.match(/^data:([^;]+);base64,(.+)$/)
        if (dataUrlMatch) {
          buf = Buffer.from(dataUrlMatch[2], 'base64')
        } else {
          buf = Buffer.from(base64, 'base64')
        }
        fs.writeFileSync(full, buf)
        return { ok: true, path: full, sizeBytes: buf.length }
      }
    })

    this.register('proxy', {
      /**
       * Forward an HTTP request from the renderer through the main process.
       *
       * Input:
       *   url        – string, required
       *   method     – GET (default), POST, PUT, DELETE, PATCH, HEAD, OPTIONS
       *   headers    – optional object, e.g. { "Content-Type": "application/json" }
       *   body       – optional string (sent as-is)
       *   timeoutMs  – optional number, default 30 000
       *
       * Returns:
       *   { ok, status, statusText, headers, body }
       */
      fetch: (input) => {
        const url = typeof input?.url === 'string' ? input.url.trim() : ''
        if (!url) throw new Error('url is required')

        const method = typeof input?.method === 'string'
          ? input.method.trim().toUpperCase()
          : 'GET'
        if (!/^[A-Z]+$/.test(method)) throw new Error(`invalid method: ${method}`)

        const reqHeaders = input?.headers && typeof input.headers === 'object' ? input.headers : {}
        const body = typeof input?.body === 'string' ? input.body : undefined
        const timeoutMs = typeof input?.timeoutMs === 'number' && input.timeoutMs > 0
          ? Math.min(input.timeoutMs, 120_000)
          : 30_000

        const u = new URL(url)
        const lib = u.protocol === 'http:' ? http : https

        const headersToSend = { ...reqHeaders }
        if (body !== undefined && !headersToSend['Content-Type'] && !headersToSend['content-type']) {
          headersToSend['Content-Type'] = 'text/plain'
        }
        if (body !== undefined && !headersToSend['Content-Length'] && !headersToSend['content-length']) {
          headersToSend['Content-Length'] = String(Buffer.byteLength(body, 'utf8'))
        }

        return new Promise((resolve, reject) => {
          const req = lib.request(
            {
              method,
              hostname: u.hostname,
              port: u.port || (u.protocol === 'http:' ? 80 : 443),
              path: `${u.pathname}${u.search || ''}`,
              headers: headersToSend,
              rejectUnauthorized: false
            },
            (res) => {
              let data = ''
              res.setEncoding('utf8')
              res.on('data', (chunk) => { data += chunk })
              res.on('end', () => {
                const respHeaders = {}
                try {
                  for (const [k, v] of Object.entries(res.headers)) {
                    respHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v || '')
                  }
                } catch {}
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  statusText: res.statusMessage || '',
                  headers: respHeaders,
                  body: data
                })
              })
              res.on('error', reject)
            }
          )
          req.on('error', reject)
          req.setTimeout(timeoutMs, () => {
            try { req.destroy(new Error('timeout')) } catch {}
          })
          if (body !== undefined) {
            req.write(body)
          }
          req.end()
        })
      }
    })
  }
}

function createEventCenter() {
  const ec = new EventCenter()
  ec.registerControlPlane()
  return ec
}

module.exports = {
  EventCenter,
  createEventCenter,
  readAppSettings,
  writeAppSettings,
  sanitizeUserKey,
  getOrCreateDeviceCode
}
