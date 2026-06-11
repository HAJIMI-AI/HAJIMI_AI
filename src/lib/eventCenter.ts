export type ClientConfig = {
  mode: 'ipc' | 'mqtt' | 'both'
  userKey: string | null
  userNickname: string | null
  userAvatar: string | null
  deviceCode: string | null
  mqtt: {
    url: string
    username?: string
    password?: string
  } | null
  setupCompleted: boolean
  mqttEnabled: boolean
  mqttDisabledReason: string
  devMode: boolean
}

export type LocalProfile = {
  exists: boolean
  userKey: string
  nickname: string | null
  avatar: string | null
}

export type ProfileItem = {
  userKey: string
  nickname: string
  avatar: string | null
  updatedAt: number | null
}

export type ManagedAppItem = {
  id: string
  alias: string
  directory: string
  indexHtmlPath?: string | null
  iconBase64?: string | null
  hsq: {
    appId: string
    appName: string
    appVersion: string
    appDescription: string
    gitUrl?: string
    mode: 'local' | 'remote'
    remoteUrl?: string
    hasIndexHtml?: boolean
    dev?: boolean
  }
  createdAt?: number
  updatedAt?: number
  pinned?: boolean
}

export type SkillItem = {
  id: string
  name: string
  scope: 'shared' | string
  directory: string
  sourceDirectory: string
  fileCount: number
  createdAt: number
  updatedAt: number
}

export type PluginPackItem = {
  id: string
  name: string
  description: string
  scope: 'shared' | string
  skillIds: string[]
  embeddedSkills?: { id: string; name: string; deleted?: boolean }[]
  mcpConfigIds: string[]
  embeddedMcpConfigs?: { id: string; name: string; deleted?: boolean }[]
  directory: string
  hasMcp: boolean
  createdAt: number
  updatedAt: number
}

export type McpConfigItem = {
  id: string
  name: string
  description: string
  scope: 'shared' | string
  config: object
  directory: string
  createdAt: number
  updatedAt: number
}

export type ManagedModelItem = {
  id: string
  alias: string
  name: string
  api_url: string
  api_token: string
  createdAt?: number
  updatedAt?: number
}

export type MqttBrokerStatus = {
  running: boolean
  port: number
  wsPort: number
  wsUrl: string | null
  tcpUrl: string | null
  wsEnabled: boolean
  hasAuth: boolean
  clientCount: number
}

export type MqttBrokerConfig = {
  enabled: boolean
  port: number
  wsEnabled: boolean
  wsPort: number
  username: string
  hasAuth: boolean
}

export type MqttBrokerClient = {
  id: string
  address: string
  connectedAt: number
}

export type ProxyFetchInput = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export type ProxyFetchResult = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export type AgentRunResult = {
  sessionId: string
  messageId: string
  ok: boolean
  result: string
  stopReason: string | null
  usage: unknown
  totalCostUsd: number | null
  messages: unknown[] | null
}

export type ContextFile = {
  path: string
  content: string
  size: number
  name: string
  ext: string
}

export type ImageInput = {
  base64: string       // data URL format: "data:image/png;base64,..."
  detail?: 'auto' | 'low' | 'high'  // resolution control, default 'auto'
}

export type ReadImageResult = {
  ok: true
  path: string
  base64: string       // data URL
  mimeType: string
  width: number
  height: number
  sizeBytes: number
}

export type FilePreviewResult = {
  type: 'text' | 'image' | 'binary'
  path: string
  name: string
  ext: string
  sizeBytes: number

  // text
  content?: string
  language?: string
  truncated?: boolean

  // image
  base64?: string
  mimeType?: string
  width?: number
  height?: number
}

export type AppEventPayload = {
  sourceAppId: string | null
  eventName: string
  data: unknown
  timestamp: number
}

export type EventCenterAPI = {
  invoke: (service: string, method: string, args?: unknown[]) => Promise<unknown>
  getClientConfig: () => Promise<ClientConfig>
  // Local profile management
  setLocalProfile: (input: { userKey?: string; nickname: string; avatar?: string }) => Promise<{ userKey: string; nickname: string; avatar: string | null }>
  getLocalProfile: (input?: string | { userKey?: string }) => Promise<LocalProfile>
  listProfiles: () => Promise<{ profiles: ProfileItem[] }>
  deleteProfile: (input: string | { userKey: string }) => Promise<{ ok: true }>
  switchProfile: (input: string | { userKey: string }) => Promise<{ userKey: string; nickname: string; avatar: string | null }>
  signOut: () => Promise<{ ok: true }>
  getDevMode: () => Promise<boolean>
  setDevMode: (enabled: boolean) => Promise<{ devMode: boolean }>
  setUserKey: (userKey: string) => Promise<{ userKey: string | null }>
  getSelectedModel: () => Promise<ManagedModelItem | null>
  setSelectedModel: (id: string | null) => Promise<{ selectedModelId: string | null }>
  listModels: () => Promise<ManagedModelItem[]>
  pickFiles: (input?: { filters?: { name: string; extensions: string[] }[]; multi?: boolean }) => Promise<{ files: string[] }>
  pickWorkingDirectory: () => Promise<{ directory: string | null }>
  readAbsoluteText: (input: { path: string; encoding?: string }) => Promise<ContextFile>
  readImageAsBase64: (input: { path: string; maxWidth?: number; maxHeight?: number; quality?: number }) => Promise<ReadImageResult>
  previewFile: (input: { path: string; maxTextBytes?: number; maxImageDim?: number }) => Promise<FilePreviewResult>
  showItemInFolder: (input: { path: string }) => Promise<{ ok: true }>
  previewFileDialog: (input: { filePath: string; title?: string }) => Promise<{ ok: true }>
  focusOrOpenPopup: (input: { appId: string; pathSuffix?: string }) => Promise<{ ok: true; winId: string; existing: boolean }>
  openExternalApp: (input: { path: string }) => Promise<{ ok: true }>
  openExternalAppByName: (input: { name: string }) => Promise<{ ok: true; path?: string }>
  openInBrowser: (input: { url: string }) => Promise<{ ok: true }>
  writeImageBase64: (input: { appId?: string; path: string; base64: string; overwrite?: boolean; mkdirp?: boolean }) => Promise<{ ok: true; path: string; sizeBytes: number }>
  getAppId: () => Promise<string | null>
  getAppWorkdir: (appId?: string | null) => Promise<{ workdir: string; isDefault: boolean }>
  setAppWorkdir: (input: { appId?: string | null; directory: string }) => Promise<{ workdir: string }>
  // App import modes
  // App management
  listApps: (input?: { reload?: boolean }) => Promise<{ apps: ManagedAppItem[] }>
  refreshApps: () => Promise<{ apps: ManagedAppItem[] }>
  importByFingerprint: (input: { fingerprint: string; alias: string }) => Promise<{ app: ManagedAppItem }>
  importByUrl: (input: { url: string; alias: string }) => Promise<{ app: ManagedAppItem }>
  getRunningApps: () => Promise<{ running: string[] }>
  pinApp: (input: { id: string; pinned: boolean }) => Promise<{ ok: true; pinned: boolean }>
  // Skill management
  listSkills: (input?: object) => Promise<SkillItem[]>
  uploadSkill: (input: { name?: string; sourceDirectory: string }) => Promise<SkillItem>
  uploadSkills: (input: { items: { name?: string; sourceDirectory: string }[] }) => Promise<{ skills: SkillItem[]; errors: { sourceDirectory: string; name: string; error: string }[] }>
  scanSkillDirs: (input: { parentDirectory: string }) => Promise<{ directories: { name: string; path: string; hasSkillMd: boolean; fileCount: number }[] }>
  updateSkill: (input: { id: string; name: string }) => Promise<SkillItem>
  deleteSkill: (input: { id: string }) => Promise<{ ok: true }>
  getSkillPluginPath: (id: string) => Promise<{ path: string }>
  readSkillMd: (input: { id: string }) => Promise<{ path: string; content: string; frontmatter: Record<string, string> }>
  // Plugin pack management
  listPluginPacks: (input?: object) => Promise<PluginPackItem[]>
  createPluginPack: (input: { name: string; description?: string; skillIds: string[]; mcpConfigIds?: string[] }) => Promise<PluginPackItem>
  updatePluginPack: (input: { id: string; name?: string; description?: string; skillIds?: string[]; mcpConfigIds?: string[] }) => Promise<PluginPackItem>
  deletePluginPack: (input: { id: string }) => Promise<{ ok: true }>
  getPackPluginPath: (id: string) => Promise<{ path: string }>
  // MCP config management
  listMcpConfigs: (input?: object) => Promise<McpConfigItem[]>
  createMcpConfig: (input: { name: string; description?: string; config: object }) => Promise<McpConfigItem>
  updateMcpConfig: (input: { id: string; name?: string; description?: string; config?: object }) => Promise<McpConfigItem>
  deleteMcpConfig: (input: { id: string }) => Promise<{ ok: true }>
  getMcpConfig: (input: { id: string }) => Promise<McpConfigItem>
  getMcpConfigsByIds: (input: { ids: string[] }) => Promise<McpConfigItem[]>
  getMcpPluginPath: (id: string) => Promise<{ path: string }>
  // Cross-window event communication
  sendAppEvent: (targetAppId: string, eventName: string, data?: unknown) => Promise<{ ok: true }>
  broadcastAppEvent: (eventName: string, data?: unknown) => Promise<{ ok: true; sent: number }>
  // Notify main window to refresh its app list (called by child apps)
  refreshMainAppList: () => Promise<{ ok: true }>
  // MQTT Broker (local Aedes broker)
  startMqttBroker: () => Promise<MqttBrokerStatus & { ok: boolean; alreadyRunning?: boolean }>
  stopMqttBroker: () => Promise<{ ok: boolean; alreadyStopped?: boolean }>
  getMqttBrokerStatus: () => Promise<MqttBrokerStatus>
  getMqttBrokerConfig: () => Promise<MqttBrokerConfig>
  updateMqttBrokerConfig: (input: { enabled?: boolean; port?: number; wsEnabled?: boolean; wsPort?: number; username?: string; password?: string }) => Promise<{ config: MqttBrokerConfig }>
  listMqttBrokerClients: () => Promise<{ clients: MqttBrokerClient[] }>

  // Proxy HTTP request through the main process (bypasses CORS / mixed-content restrictions)
  proxyFetch: (input: ProxyFetchInput) => Promise<ProxyFetchResult>
  runAgentWithModel: (input: {
    agentName: string
    prompt: string
    sessionId?: string
    modelId?: string
    cwd?: string
    allowTools?: boolean
    collectMessages?: boolean
    permissionMode?: string
    images?: ImageInput[]
    plugins?: { type: 'local'; path: string }[]
    sdkOptions?: Record<string, unknown>
  }) => Promise<AgentRunResult>
}

export function getEventCenter() {
  const w = window as unknown as { eventCenter?: EventCenterAPI }
  return w.eventCenter
}

export function validateUserKey(userKey: string) {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(userKey)
}

export function getErrorMessage(e: unknown) {
  if (!e) return '未知错误'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  return '未知错误'
}
