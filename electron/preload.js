const { contextBridge, ipcRenderer } = require('electron')

const CHANNEL = 'eventCenter:invoke'

const APP_ID_FROM_ARGS = (() => {
  try {
    const prefix = '--hsqAppId='
    const argv = Array.isArray(process?.argv) ? process.argv : []
    const hit = argv.find((x) => typeof x === 'string' && x.startsWith(prefix))
    const v = typeof hit === 'string' ? hit.slice(prefix.length).trim() : ''
    return v || null
  } catch {
    return null
  }
})()

function uuid() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
  } catch {}
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function createInvokeError(res) {
  const err = new Error(res?.error?.message || 'Invoke failed')
  err.name = res?.error?.name || err.name
  err.stack = res?.error?.stack || err.stack
  err.payload = res
  return err
}

async function invokeIPC(service, method, args = []) {
  let nextArgs = Array.isArray(args) ? args : []
  // Auto-inject appId for child app windows (all services except auth & eventCenter)
  if (APP_ID_FROM_ARGS && service !== 'auth' && service !== 'eventCenter') {
    if (nextArgs.length === 0) {
      // Empty args: inject appId as the sole argument
      nextArgs = [{ appId: APP_ID_FROM_ARGS }]
    } else if (nextArgs[0] && typeof nextArgs[0] === 'object') {
      // First arg is an object: merge appId if not already present
      const input0 = nextArgs[0]
      const hasAppId = typeof input0.appId === 'string' && input0.appId.trim()
      if (!hasAppId) {
        nextArgs = [{ ...input0, appId: APP_ID_FROM_ARGS }, ...nextArgs.slice(1)]
      }
    } else {
      // First arg is a string/number/etc: prepend appId object
      nextArgs = [{ appId: APP_ID_FROM_ARGS }, ...nextArgs]
    }
  }

  const payload = { id: uuid(), service, method, args: nextArgs }
  const res = await ipcRenderer.invoke(CHANNEL, payload)
  if (!res?.ok) {
    if (res?.error?.authInvalid === true) {
      try {
        window.dispatchEvent(new CustomEvent('eventCenter:authInvalid'))
      } catch {}
    }
    throw createInvokeError(res)
  }
  return res.result
}

async function invokeIPCRaw(payload) {
  return await ipcRenderer.invoke(CHANNEL, {
    id: payload?.id || uuid(),
    ...payload
  })
}

async function getClientConfig() {
  const res = await invokeIPC('eventCenter', 'getClientConfig', [])
  return {
    mode: res?.eventMode || 'ipc',
    userKey: res?.userKey || null,
    userNickname: res?.userNickname || null,
    deviceCode: res?.deviceCode || null,
    mqtt: res?.mqtt || null,
    setupCompleted: res?.setupCompleted === true,
    mqttEnabled: res?.mqttEnabled === true,
    mqttDisabledReason: typeof res?.mqttDisabledReason === 'string' ? res.mqttDisabledReason : '',
    devMode: res?.devMode === true
  }
}

contextBridge.exposeInMainWorld('eventCenter', {
  invoke: invokeIPC,
  invokeIPC,
  invokeIPCRaw,
  getClientConfig,
  createCaptcha: async (input) => {
    const res = await invokeIPC('auth', 'createCaptcha', [input])
    return res
  },
  refreshCaptcha: async (input) => {
    const res = await invokeIPC('auth', 'refreshCaptcha', [input])
    return res
  },
  login: async (input) => {
    const res = await invokeIPC('auth', 'login', [input])
    return res
  },
  register: async (input) => {
    const res = await invokeIPC('auth', 'register', [input])
    return res
  },
  getAccountInfo: async () => {
    const res = await invokeIPC('auth', 'getAccountInfo', [])
    return res
  },
  updatePassword: async (input) => {
    const res = await invokeIPC('auth', 'updatePassword', [input])
    return res
  },
  logout: async () => {
    const res = await invokeIPC('auth', 'logout', [])
    return res
  },
  getUserKey: async () => (await invokeIPC('eventCenter', 'getUserKey', [])).userKey,
  setUserKey: async (userKey) => {
    const res = await invokeIPC('eventCenter', 'setUserKey', [userKey])
    return res
  },
  // Local profile management
  setLocalProfile: async (input) => {
    const res = await invokeIPC('eventCenter', 'setLocalProfile', [input])
    return res
  },
  getLocalProfile: async (input) => {
    const res = await invokeIPC('eventCenter', 'getLocalProfile', [input])
    return res
  },
  listProfiles: async () => {
    const res = await invokeIPC('eventCenter', 'listProfiles', [])
    return res
  },
  deleteProfile: async (input) => {
    const res = await invokeIPC('eventCenter', 'deleteProfile', [input])
    return res
  },
  switchProfile: async (input) => {
    const res = await invokeIPC('profile', 'switchTo', [input])
    return res
  },
  signOut: async () => {
    const res = await invokeIPC('profile', 'signOut', [])
    return res
  },
  getEventMode: async () => (await invokeIPC('eventCenter', 'getEventMode', [])).eventMode,
  setEventMode: async (input) => {
    const res = await invokeIPC('eventCenter', 'setEventMode', [input])
    return res
  },
  getDevMode: async () => (await invokeIPC('eventCenter', 'getDevMode', [])).devMode,
  setDevMode: async (enabled) => {
    const res = await invokeIPC('eventCenter', 'setDevMode', [{ enabled }])
    return res
  },
  getMqttConfig: async () => (await invokeIPC('eventCenter', 'getMqttConfig', [])).mqtt,
  setMqttConfig: async (mqtt) => {
    const res = await invokeIPC('eventCenter', 'setMqttConfig', [mqtt])
    return res
  },

  // MQTT Broker (local Aedes broker)
  startMqttBroker: async () => {
    return await invokeIPC('mqttBroker', 'start', [])
  },
  stopMqttBroker: async () => {
    return await invokeIPC('mqttBroker', 'stop', [])
  },
  getMqttBrokerStatus: async () => {
    return await invokeIPC('mqttBroker', 'getStatus', [])
  },
  getMqttBrokerConfig: async () => {
    return await invokeIPC('mqttBroker', 'getConfig', [])
  },
  updateMqttBrokerConfig: async (input) => {
    return await invokeIPC('mqttBroker', 'updateConfig', [input])
  },
  listMqttBrokerClients: async () => {
    return await invokeIPC('mqttBroker', 'listClients', [])
  },

  pickDirectory: async () => {
    const res = await invokeIPC('apps', 'pickDirectory', [])
    return res
  },
  // App list
  listApps: async (input) => {
    return await invokeIPC('apps', 'list', [input || {}])
  },
  refreshApps: async () => {
    return await invokeIPC('apps', 'list', [{ reload: true }])
  },
  importByFingerprint: async (input) => {
    const res = await invokeIPC('apps', 'importByFingerprint', [input])
    return res
  },
  importByUrl: async (input) => {
    const res = await invokeIPC('apps', 'importByUrl', [input])
    return res
  },
  getRunningApps: async () => {
    const res = await invokeIPC('apps', 'getRunning', [])
    return res
  },
  pinApp: async (input) => {
    const res = await invokeIPC('apps', 'pin', [input])
    return res
  },
  storageGet: async (input) => {
    const res = await invokeIPC('appStorage', 'get', [input])
    return res
  },
  storageSet: async (input) => {
    const res = await invokeIPC('appStorage', 'set', [input])
    return res
  },
  storageRemove: async (input) => {
    const res = await invokeIPC('appStorage', 'remove', [input])
    return res
  },
  storageList: async (input) => {
    const res = await invokeIPC('appStorage', 'list', [input])
    return res
  },
  getAppDetail: async (input) => {
    const res = await invokeIPC('apps', 'getByAppId', [input])
    return res
  },
  openAppPopup: async (input) => {
    const res = await invokeIPC('apps', 'openPopup', [input])
    return res
  },
  replaceWithAppPopup: async (input) => {
    const res = await invokeIPC('apps', 'replaceWithPopup', [input])
    return res
  },
  closeCurrentWindow: async () => {
    const res = await invokeIPC('apps', 'closeCurrentWindow', [])
    return res
  },
  focusOrOpenPopup: async (input) => {
    return await invokeIPC('apps', 'focusOrOpenPopup', [input])
  },
  writeTextFile: async (input) => {
    const res = await invokeIPC('files', 'writeText', [input])
    return res
  },
  readTextFile: async (input) => {
    const res = await invokeIPC('files', 'readText', [input])
    return res
  },
  deletePath: async (input) => {
    const res = await invokeIPC('files', 'delete', [input])
    return res
  },
  copyPath: async (input) => {
    const res = await invokeIPC('files', 'copy', [input])
    return res
  },
  movePath: async (input) => {
    const res = await invokeIPC('files', 'move', [input])
    return res
  },
  getDeviceCode: async () => (await invokeIPC('eventCenter', 'getDeviceCode', [])).deviceCode,

  // File/directory picking
  pickFiles: async (input) => {
    return await invokeIPC('files', 'pickFiles', [input || {}])
  },
  pickWorkingDirectory: async () => {
    return await invokeIPC('files', 'pickWorkingDirectory', [])
  },
  readAbsoluteText: async (input) => {
    return await invokeIPC('files', 'readAbsoluteText', [input])
  },

  // File preview (auto-detect type)
  previewFile: async (input) => {
    return await invokeIPC('files', 'previewFile', [input])
  },

  // Open document with default OS app
  openExternalApp: async (input) => {
    return await invokeIPC('app', 'openExternalApp', [input])
  },
  // Open an app by name (cross-platform)
  openExternalAppByName: async (input) => {
    return await invokeIPC('app', 'openExternalAppByName', [input])
  },
  // Open URL in default browser
  openInBrowser: async (input) => {
    return await invokeIPC('app', 'openInBrowser', [input])
  },

  // Reveal file in system file manager
  showItemInFolder: async (input) => {
    return await invokeIPC('files', 'showItemInFolder', [input])
  },

  // Open a preview window/dialog for the file
  previewFileDialog: async (input) => {
    return await invokeIPC('app', 'previewFileDialog', [input])
  },

  // Image read/write
  readImageAsBase64: async (input) => {
    return await invokeIPC('files', 'readImageAsBase64', [input])
  },
  writeImageBase64: async (input) => {
    return await invokeIPC('files', 'writeImageBase64', [input])
  },

  // Model management convenience methods
  getSelectedModel: async () => {
    return await invokeIPC('modules', 'getSelectedModel', [])
  },
  setSelectedModel: async (id) => {
    return await invokeIPC('modules', 'setSelectedModel', [id])
  },
  listModels: async () => {
    return await invokeIPC('modules', 'listModels', [])
  },

  // Agent run with model info automatically injected
  runAgentWithModel: async (input) => {
    const modelId = typeof input?.modelId === 'string' && input.modelId.trim() ? input.modelId.trim() : null
    let model = null

    if (modelId) {
      model = await invokeIPC('modules', 'getModel', [modelId])
    }

    if (!model) {
      // Fall back to selected model
      model = await invokeIPC('modules', 'getSelectedModel', [])
    }

    if (!model) {
      // Fall back to first model in the list
      const models = await invokeIPC('modules', 'listModels', [])
      model = Array.isArray(models) && models.length > 0 ? models[0] : null
    }

    if (!model) {
      throw new Error('未配置 AI 模型，请先在主窗口设置 → 模型管理中至少添加一个模型')
    }

    // Resolve cwd: explicit > app workdir (child apps) > undefined
    let cwd = input.cwd || undefined

    if (!cwd && APP_ID_FROM_ARGS) {
      try {
        const wr = await invokeIPC('apps', 'getAppWorkdir', [APP_ID_FROM_ARGS])
        if (wr?.workdir) cwd = wr.workdir
      } catch {
        // Ignore — app workdir resolution failure should not block agent call
      }
    }

    const images = Array.isArray(input?.images) && input.images.length > 0 ? input.images : undefined
    const plugins = Array.isArray(input?.plugins) && input.plugins.length > 0 ? input.plugins : undefined
    const sdkOptions = input?.sdkOptions && typeof input.sdkOptions === 'object' ? input.sdkOptions : undefined

    const agentInput = {
      agentName: input.agentName,
      prompt: input.prompt,
      sessionId: input.sessionId || undefined,
      cwd,
      allowTools: input.allowTools === true,
      collectMessages: input.collectMessages === true,
      permissionMode: input.permissionMode || undefined,
      images,
      plugins,
      ...(sdkOptions ? { sdkOptions } : {})
    }
    // Merge model info if available (don't overwrite explicit values)
    if (model) {
      if (model.name && !agentInput.model) {
        agentInput.model = model.name
      }
      if (model.api_token && !agentInput.api_token) {
        agentInput.api_token = model.api_token
      }
      if (model.api_url && !agentInput.api_url) {
        agentInput.api_url = model.api_url
      }
    }
    return await invokeIPC('agent', 'runAgent', [agentInput])
  },

  // Skill management
  listSkills: async (input) => {
    return await invokeIPC('skills', 'listSkills', [input || {}])
  },
  uploadSkill: async (input) => {
    return await invokeIPC('skills', 'uploadSkill', [input])
  },
  uploadSkills: async (input) => {
    return await invokeIPC('skills', 'uploadSkills', [input])
  },
  scanSkillDirs: async (input) => {
    return await invokeIPC('skills', 'scanSkillDirs', [input])
  },
  updateSkill: async (input) => {
    return await invokeIPC('skills', 'updateSkill', [input])
  },
  deleteSkill: async (input) => {
    return await invokeIPC('skills', 'deleteSkill', [input])
  },
  getSkillPluginPath: async (id) => {
    return await invokeIPC('skills', 'getPluginPath', [{ id }])
  },
  readSkillMd: async (input) => {
    return await invokeIPC('skills', 'readSkillMd', [input])
  },

  // Plugin pack management
  listPluginPacks: async (input) => {
    return await invokeIPC('pluginPacks', 'listPluginPacks', [input || {}])
  },
  createPluginPack: async (input) => {
    return await invokeIPC('pluginPacks', 'createPluginPack', [input])
  },
  updatePluginPack: async (input) => {
    return await invokeIPC('pluginPacks', 'updatePluginPack', [input])
  },
  deletePluginPack: async (input) => {
    return await invokeIPC('pluginPacks', 'deletePluginPack', [input])
  },
  getPackPluginPath: async (id) => {
    return await invokeIPC('pluginPacks', 'getPluginPath', [{ id }])
  },

  // Get the full app item data for the current child window (name, icon, version, etc.)
  // Returns null when called from the main window (no appId).
  getAppData: async () => {
    if (!APP_ID_FROM_ARGS) return null
    return await invokeIPC('apps', 'getCurrentAppItem', [])
  },
  // App working directory management
  getAppId: async () => APP_ID_FROM_ARGS,
  getAppWorkdir: async (appId) => {
    return await invokeIPC('apps', 'getAppWorkdir', [appId || APP_ID_FROM_ARGS])
  },
  setAppWorkdir: async (input) => {
    const appId = input?.appId || APP_ID_FROM_ARGS
    return await invokeIPC('apps', 'setAppWorkdir', [{ appId, directory: input?.directory }])
  },

  // Notify the main window to refresh its app list (called by child apps)
  refreshMainAppList: async () => {
    return await invokeIPC('apps', 'refreshMainAppList', [])
  },

  // MCP config management
  listMcpConfigs: async (input) => {
    return await invokeIPC('mcpConfigs', 'listMcpConfigs', [input || {}])
  },
  createMcpConfig: async (input) => {
    return await invokeIPC('mcpConfigs', 'createMcpConfig', [input])
  },
  updateMcpConfig: async (input) => {
    return await invokeIPC('mcpConfigs', 'updateMcpConfig', [input])
  },
  deleteMcpConfig: async (input) => {
    return await invokeIPC('mcpConfigs', 'deleteMcpConfig', [input])
  },
  getMcpConfig: async (input) => {
    return await invokeIPC('mcpConfigs', 'getMcpConfig', [input])
  },
  getMcpConfigsByIds: async (input) => {
    return await invokeIPC('mcpConfigs', 'getMcpConfigsByIds', [input])
  },
  getMcpPluginPath: async (id) => {
    return await invokeIPC('mcpConfigs', 'getMcpPluginPath', [{ id }])
  },

  // Proxy HTTP requests through the main process (bypasses CORS / mixed-content restrictions)
  proxyFetch: async (input) => {
    return await invokeIPC('proxy', 'fetch', [input])
  }
})

// Bridge: main process → DOM event so the main window can react without polling.
// refreshMainAppList → apps:refresh-list → apps-refresh DOM event
ipcRenderer.on('apps:refresh-list', () => {
  try { window.dispatchEvent(new CustomEvent('apps-refresh')) } catch {}
})
