# API Reference

通过 `window.eventCenter` 调用，由 Electron preload 注入到所有窗口。

## 调用方式

```ts
// 推荐：直接方法
await window.eventCenter.listApps()

// 通用：invoke 路由
await window.eventCenter.invoke("apps", "list", [])
```

## API 速查

| 方法 | 用途 | 入参 | 返回 |
|---|---|---|---|
| `getClientConfig()` | 获取本机配置 | - | `{ mode, userKey, userNickname, deviceCode, mqtt, devMode, ... }` |
| `getUserKey()` | 获取当前 userKey | - | `string \| null` |
| `setUserKey(userKey)` | 设置当前 userKey | `string` | `{ userKey }` |
| `setLocalProfile(input)` | 创建/更新本地账户 | `{ userKey, nickname, avatar? }` | `{ userKey, nickname, avatar }` |
| `getLocalProfile(userKey?)` | 获取本地账户 | `string?` | `{ exists, userKey, nickname, avatar }` |
| `listProfiles()` | 列出所有本地账户 | - | `{ profiles: ProfileItem[] }` |
| `switchProfile(input)` | 切换到已有账户（MQTT 自动重连） | `string \| { userKey }` | `{ userKey, nickname, avatar }` |
| `signOut()` | 退出登录（断开 MQTT） | - | `{ ok: true }` |
| `deleteProfile(input)` | 删除账户及全部数据（模型、应用、KV、MQTT 配置等） | `string \| { userKey }` | `{ ok: true }` |
| `listApps(input?)` | 获取应用列表 | `{ reload?: boolean }` | `{ apps: ManagedAppItem[] }` |
| `refreshApps()` | 强制刷新应用列表 | - | `{ apps: ManagedAppItem[] }` |
| `focusOrOpenPopup(input)` | 打开应用弹窗（已打开则聚焦） | `{ appId, pathSuffix? }` | `{ ok, winId, existing }` |
| `openAppPopup({ appId, pathSuffix })` | 打开新弹窗 | `{ appId, pathSuffix \| path }` | `{ ok: true, winId }` |
| `closeCurrentWindow()` | 关闭当前窗口 | - | `{ ok: true }` |
| `listModels()` | 列出所有模型 | - | `ManagedModelItem[]` |
| `getSelectedModel()` | 获取默认模型 | - | `ManagedModelItem \| null` |
| `setSelectedModel(id)` | 设置默认模型 | `string \| null` | `{ selectedModelId }` |
| `runAgentWithModel(input)` | 一键调用 Agent（自动解析模型+工作目录） | `{ agentName, prompt, modelId?, cwd?, allowTools?, images?, plugins?, ... }` | `AgentRunResult` |
| `runAgent(input)` | 底层 Agent 调用（需自行传入模型配置） | `{ agentName, prompt, model?, api_token?, api_url?, cwd?, allowTools?, ... }` | `AgentRunResult` |
| `listAgents()` | 列出已注册 Agent 引擎 | - | `{ name, description }[]` |
| `readAbsoluteText(input)` | 读取任意路径文本文件 | `{ path, encoding? }` | `{ ok, path, content, size, name, ext }` |
| `readImageAsBase64(input)` | 读取图片转 base64 | `{ path, maxWidth?, maxHeight?, quality? }` | `{ ok, path, base64, mimeType, width, height }` |
| `pickFiles(input?)` | 打开文件选择器 | `{ filters?, multi? }` | `{ files: string[] }` |
| `pickWorkingDirectory()` | 打开目录选择器 | - | `{ directory: string \| null }` |
| `writeTextFile(input)` | 写入文本文件（限定应用目录） | `{ appId, path, content, encoding?, overwrite?, mkdirp? }` | `{ ok, path }` |
| `readTextFile(input)` | 读取文本文件（限定应用目录） | `{ appId, path, encoding? }` | `{ ok, path, content }` |
| `deletePath(input)` | 删除文件/目录 | `{ appId, path, recursive? }` | `{ ok, deleted }` |
| `copyPath(input)` | 复制文件 | `{ appId, from, to, overwrite?, mkdirp? }` | `{ ok, from, to }` |
| `movePath(input)` | 移动/重命名 | `{ appId, from, to, overwrite?, mkdirp? }` | `{ ok, from, to }` |
| `storageGet({ appId, key })` | 应用 KV：读取 | `{ appId, key }` | `{ exists, value }` |
| `storageSet({ appId, key, value })` | 应用 KV：写入 | `{ appId, key, value }` | `{ ok: true }` |
| `storageRemove({ appId, key })` | 应用 KV：删除 | `{ appId, key }` | `{ ok: true }` |
| `storageList({ appId, prefix? })` | 应用 KV：列出 | `{ appId, prefix? }` | `{ items }` |
| `proxyFetch(input)` | 主进程 HTTP 代理 | `{ url, method?, headers?, body?, timeoutMs? }` | `{ ok, status, statusText, headers, body }` |
| `previewFile(input)` | 文件预览（自动识别类型） | `{ path, maxTextBytes?, maxImageDim? }` | `FilePreviewResult` |
| `previewFileDialog(input)` | 独立窗口预览文件 | `{ filePath, title? }` | `{ ok: true }` |
| `showItemInFolder(input)` | 系统文件管理器定位 | `{ path }` | `{ ok: true }` |
| `openInBrowser(input)` | 浏览器打开 URL | `{ url }` | `{ ok: true }` |
| `openExternalApp(input)` | 默认程序打开文件 | `{ path }` | `{ ok: true }` |
| `openExternalAppByName(input)` | 按名称启动应用 | `{ name }` | `{ ok: true }` |
| `showMain()` | 显示主窗口 | - | `{ ok: true }` |
| `quit()` | 退出应用 | - | `{ ok: true }` |
| `getAppId()` | 获取当前窗口 appId | - | `string \| null` |
| `getAppWorkdir(appId?)` | 获取应用工作目录 | `string?` | `{ workdir, isDefault }` |
| `setAppWorkdir({ appId?, directory })` | 设置应用工作目录 | `{ appId?, directory }` | `{ workdir }` |
| `getRunningApps()` | 获取运行中应用 | - | `{ running: string[] }` |
| `pinApp(input)` | 置顶/取消置顶 | `{ id, pinned }` | `{ ok, pinned }` |
| `listSkills(input?)` | 列出技能 | `{}` | `SkillItem[]` |
| `uploadSkill(input)` | 上传技能 | `{ name?, sourceDirectory }` | `{ skill }` |
| `deleteSkill(input)` | 删除技能 | `{ id }` | `{ ok: true }` |
| `getSkillPluginPath(id)` | 技能插件路径 | `string` | `{ path }` |
| `listPluginPacks(input?)` | 列出插件包 | `{}` | `PluginPackItem[]` |
| `createPluginPack(input)` | 创建插件包 | `{ name, description?, skillIds?, mcpConfigIds? }` | `{ pack }` |
| `updatePluginPack(input)` | 更新插件包 | `{ id, name?, description?, skillIds?, mcpConfigIds? }` | `{ pack }` |
| `deletePluginPack(input)` | 删除插件包 | `{ id }` | `{ ok: true }` |
| `getPackPluginPath(id)` | 插件包路径 | `string` | `{ path }` |
| `listMcpConfigs(input?)` | 列出 MCP 配置 | `{}` | `McpConfigItem[]` |
| `createMcpConfig(input)` | 创建 MCP 配置 | `{ name, description?, config }` | `McpConfigItem` |
| `updateMcpConfig(input)` | 更新 MCP 配置 | `{ id, name?, description?, config? }` | `McpConfigItem` |
| `deleteMcpConfig(input)` | 删除 MCP 配置 | `{ id }` | `{ ok: true }` |
| `getMcpPluginPath(id)` | MCP 插件路径 | `string` | `{ path }` |
| `getDevMode()` | 开发者模式状态 | - | `boolean` |
| `setDevMode(enabled)` | 设置开发者模式 | `boolean` | `{ devMode }` |

## 核心数据类型

```ts
type ManagedAppItem = {
  id: string
  alias: string
  directory: string
  iconBase64: string | null
  hsq: {
    appId: string; appName: string; appVersion: string
    appDescription: string; mode: 'local' | 'remote'
    remoteUrl?: string; gitUrl?: string; dev?: boolean
  }
  pinned?: boolean
  createdAt?: number; updatedAt?: number
}

type ManagedModelItem = {
  id: string; alias: string; name: string
  api_url: string; api_token: string
  createdAt: number; updatedAt: number
}

type AgentRunResult = {
  sessionId: string; messageId: string; ok: boolean
  result: string; stopReason: string
  usage: object; totalCostUsd: number | null
  messages?: object[]
}

type SkillItem = {
  id: string; name: string
  scope: 'shared' | string
  directory: string; sourceDirectory: string
  fileCount: number; createdAt: number; updatedAt: number
}

type PluginPackItem = {
  id: string; name: string; description: string
  scope: 'shared' | string
  skillIds: string[]; mcpConfigIds: string[]
  directory: string; hasMcp: boolean
  createdAt: number; updatedAt: number
}

type McpConfigItem = {
  id: string; name: string; description: string
  scope: 'shared' | string
  config: object
  directory: string; createdAt: number; updatedAt: number
}

type ProxyFetchInput = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

type ProxyFetchResult = {
  ok: boolean; status: number; statusText: string
  headers: Record<string, string>; body: string
}
```

## 服务列表

通用 invoke 可调用的所有服务：

```ts
// 查看全部
const services = await window.eventCenter.invoke("eventCenter", "listServices", [])
```

### eventCenter（配置/环境）

- `invoke("eventCenter","getClientConfig",[])`
- `invoke("eventCenter","getUserKey",[])` / `setUserKey`
- `invoke("eventCenter","getEventMode",[])` / `setEventMode`
- `invoke("eventCenter","getMqttConfig",[])` / `setMqttConfig`
- `invoke("eventCenter","testMqttConnection",[{ url, username?, password?, timeoutMs? }])`
- `invoke("eventCenter","getDevMode",[])` / `setDevMode`
- `invoke("eventCenter","setLocalProfile",[input])`
- `invoke("eventCenter","getLocalProfile",[input])`
- `invoke("eventCenter","listProfiles",[])`
- `invoke("eventCenter","switchProfile",[input])` — 切换账户，MQTT 自动以新 userKey 重连
- `invoke("eventCenter","signOut",[])` — 退出登录，断开 MQTT
- `invoke("eventCenter","deleteProfile",[input])` — 清空账户全部数据
- `invoke("eventCenter","listServices",[])`

### apps（应用 CRUD / 启动 / 弹窗）

- `invoke("apps","list",[])`
- `invoke("apps","create",[{ alias, directory }])`
- `invoke("apps","update",[{ id, alias?, directory? }])`
- `invoke("apps","remove",[{ id }])`
- `invoke("apps","open",[{ id }])`
- `invoke("apps","openPopup",[{ appId, pathSuffix }])`
- `invoke("apps","importByFingerprint",[{ fingerprint, alias }])`
- `invoke("apps","importByUrl",[{ url, alias }])`
- `invoke("apps","getRunning",[])` — 运行中应用
- `invoke("apps","pinApp",[{ id, pinned }])` — 置顶
- `invoke("apps","getAppWorkdir",[appId])`
- `invoke("apps","setAppWorkdir",[{ appId, directory }])`

### modules（模型管理）

- `invoke("modules","listModels",[])`
- `invoke("modules","createModel",[{ alias, name, api_url, api_token }])`
- `invoke("modules","updateModel",[id, { alias, name, api_url, api_token }])`
- `invoke("modules","deleteModel",[id])`
- `invoke("modules","testModelConnection",[{ api_url, api_token, timeoutMs? }])`
- `invoke("modules","getSelectedModel",[])` / `setSelectedModel`

### agent（AI Agent）

- `invoke("agent","listAgents",[])`
- `invoke("agent","runAgent",[{ agentName, prompt, sessionId?, model?, api_token?, api_url?, cwd?, allowTools?, collectMessages?, images?, plugins? }])`
- `invoke("agent","runAgentWithModel",[{ agentName, prompt, modelId?, cwd?, allowTools?, collectMessages?, images?, plugins?, sdkOptions? }])` — 自动解析模型（modelId → 默认 → 首个）+ cwd（appId 工作目录），IPC/MQTT 均可

### app（系统操作）

- `invoke("app","showMain",[])` — 显示主窗口
- `invoke("app","quit",[])` — 退出应用
- `invoke("app","openInBrowser",[{ url }])` — 系统默认浏览器打开 URL
- `invoke("app","openExternalApp",[{ path }])` — 默认程序打开文件/目录
- `invoke("app","openExternalAppByName",[{ name }])` — 按名称启动应用
- `invoke("app","previewFileDialog",[{ filePath, title? }])` — 独立窗口预览文件

### skills（技能）

- `invoke("skills","listSkills",[{ appId? }])`
- `invoke("skills","uploadSkill",[{ name?, sourceDirectory }])`
- `invoke("skills","updateSkill",[{ id, name }])`
- `invoke("skills","deleteSkill",[{ id }])`
- `invoke("skills","getPluginPath",[{ id }])`

### pluginPacks（插件包）

- `invoke("pluginPacks","listPluginPacks",[{ appId? }])`
- `invoke("pluginPacks","createPluginPack",[{ name, description?, skillIds, mcpConfigIds? }])`
- `invoke("pluginPacks","updatePluginPack",[{ id, name?, description?, skillIds?, mcpConfigIds? }])`
- `invoke("pluginPacks","deletePluginPack",[{ id }])`
- `invoke("pluginPacks","getPluginPath",[{ id }])`

### mcpConfigs（MCP 配置）

- `invoke("mcpConfigs","listMcpConfigs",[])`
- `invoke("mcpConfigs","createMcpConfig",[{ name, description?, config }])`
- `invoke("mcpConfigs","updateMcpConfig",[{ id, name?, description?, config? }])`
- `invoke("mcpConfigs","deleteMcpConfig",[{ id }])`
- `invoke("mcpConfigs","getMcpConfig",[{ id }])`
- `invoke("mcpConfigs","getMcpConfigsByIds",[{ ids }])`
- `invoke("mcpConfigs","getMcpPluginPath",[{ id }])`

### appStorage（应用 KV）

- `invoke("appStorage","get",[{ appId, key }])`
- `invoke("appStorage","set",[{ appId, key, value }])`
- `invoke("appStorage","remove",[{ appId, key }])`
- `invoke("appStorage","list",[{ appId, prefix? }])`

### files（文件操作）

- `invoke("files","pickFiles",[{ filters?, multi? }])`
- `invoke("files","pickWorkingDirectory",[])`
- `invoke("files","readAbsoluteText",[{ path, encoding? }])`
- `invoke("files","readImageAsBase64",[{ path, maxWidth?, maxHeight?, quality? }])`
- `invoke("files","previewFile",[{ path, maxTextBytes?, maxImageDim? }])`
- `invoke("files","showItemInFolder",[{ path }])`
- `invoke("files","writeImageBase64",[{ appId, path, base64, overwrite?, mkdirp? }])`
- `invoke("files","writeText",[{ appId, path, content, encoding?, overwrite?, mkdirp? }])`
- `invoke("files","readText",[{ appId, path, encoding? }])`
- `invoke("files","delete",[{ appId, path, recursive? }])`
- `invoke("files","copy",[{ appId, from, to, overwrite?, mkdirp? }])`
- `invoke("files","move",[{ appId, from, to, overwrite?, mkdirp? }])`

### proxy（HTTP 代理）

- `invoke("proxy","fetch",[{ url, method?, headers?, body?, timeoutMs? }])` — 绕过 CORS

### mqttBroker（本地 MQTT Broker）

内置 Aedes Broker，默认 `mqtt://localhost:1883` (TCP) + `ws://localhost:1884` (WebSocket)。

- `invoke("mqttBroker","start",[])` — 手动启动
- `invoke("mqttBroker","stop",[])` — 手动停止
- `invoke("mqttBroker","getStatus",[])` — 运行状态（端口、客户端数、认证等）
- `invoke("mqttBroker","getConfig",[])` — Broker 配置（密码不返回）
- `invoke("mqttBroker","updateConfig",[{ enabled, port, wsEnabled, wsPort, username, password }])` — 更新配置（自动重启）
- `invoke("mqttBroker","listClients",[])` — 已连接客户端列表

> Broker 与 userKey 无关，应用启动自动运行。切换账户不影响 Broker。

### logger（运行日志）

- `invoke("logger","query",[{ level?, category?, startTime?, endTime?, limit?, offset? }])` — 查询内存日志（最近 5000 条）
- `invoke("logger","getConfig",[])` — 获取日志配置
- `invoke("logger","updateConfig",[{ level?, format?, consoleEnabled?, keepDays?, maxFileSizeMB?, maxTotalSizeMB? }])` — 更新日志配置
- `invoke("logger","export",[{ startTime?, endTime? }])` — 导出日志文件路径
- `invoke("logger","clear",[])` — 清空所有日志

> 日志目录 `{userData}/logs/`，按天轮转，默认保留 7 天 / 100MB。

## MQTT 远程通信

切换到 MQTT 模式后可通过 MQTT Broker 调用以上全部服务，无需 Electron IPC。

### Topic 规则

| 角色 | Topic |
|------|-------|
| 请求 | `{userKey}/request` |
| 响应 | `{userKey}/{appId}/{appUserId}/response/s2c` |

### 消息格式

```json
// 请求
{ "id": "req-001", "appUserId": "user-abc", "service": "modules", "method": "listModels", "args": [{ "appId": "my-app" }] }

// 成功响应
{ "id": "req-001", "ok": true, "result": { ... } }

// 失败响应
{ "id": "req-001", "ok": false, "error": { "name": "ErrorName", "message": "..." } }
```

### 约束

- `appUserId` 与 `appId`（args[0]）必填，缺一静默丢弃
- 每个 `appId + appUserId` 享有独立响应 topic，天然客户端隔离
- 切换账户时 MQTT 自动以新 userKey 重连，未配 MQTT 则断开
- JSON 解析失败的消息静默丢弃
- 建议为 Broker 配置用户名密码防未授权访问

> 🧪 测试脚本与 API 示例：[HAJIMI_MQTT_TEST](https://github.com/HAJIMI-AI/HAJIMI_MQTT_TEST)

## appId 自动注入

通过子应用窗口打开的窗口携带 `--hsqAppId=<appId>`，调用 API 时自动注入 appId（除 `auth` 和 `eventCenter` 服务）。

## 窗口行为

- `apps.open`：同一 appId 单实例窗口，重复调用切换到已有窗口
- `openAppPopup`：每次新建弹窗，默认以当前窗口为 parent
- `replaceWithAppPopup`：先关闭当前窗口再打开新弹窗
- 远程应用自动缓存破坏：新窗口追加 `_t` 参数 + no-cache 头，已有窗口 `reloadIgnoringCache()`

## 远程应用缓存

远程应用（`mode: 'remote'`）自动破坏缓存：
- **新窗口**：`_t` 时间戳参数 + `Cache-Control: no-cache` / `Pragma: no-cache` 请求头
- **已有窗口**：`reloadIgnoringCache()` 强制跳过浏览器缓存

## 开发者模式

```ts
await window.eventCenter.setDevMode(true)   // 所有窗口打开 DevTools
await window.eventCenter.setDevMode(false)  // 关闭 DevTools
```

即使全局关闭，`hsq.config.json` 中 `"dev": true` 仍会为该应用打开 DevTools。

## 安全

- 避免在渲染进程打印 `api_token`、密码到控制台
- 文件操作限定在应用目录内（`appId` 作用域）
- `storageSet` 允许任意 JSON，建议 key 加命名空间前缀
