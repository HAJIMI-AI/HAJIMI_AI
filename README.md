<h1 align="center">🐱 哈基米 (Hajimi)</h1>
<p align="center"><strong>AI 应用平台</strong> — 封装智能体调用、技能/模型管理，自由组合不同技能与模型，打造你的本地 AI 工作站。</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img src="https://img.shields.io/badge/electron-33%2B-9feaf9" />
  <img src="https://img.shields.io/badge/react-18-61dafb" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

## ✨ 功能

目前只支持 Claude Agent SDK，后续支持更多 agent。

- **多模型管理** — 接入 Claude 等兼容 API，统一管理多个模型配置
- **技能系统** — 上传 Claude Agent Skills，组装为插件包，随意组合
- **应用管理** — 本地/远程/指纹三种方式导入应用，同一 appId 单实例窗口
- **多账户** — 本地账户系统，每个账户独立隔离（应用、模型、会话、KV）
- **Agent 引擎** — 内置 Claude Agent SDK，支持 Vision、文件上下文、插件注入
- **HTTP 代理** — `proxyFetch` 主进程代理，绕过 CORS / 混合内容限制
- **MCP 支持** — MCP 配置作为独立 Claude 插件使用，也可合并到插件包
- **本地 MQTT 服务** — 内置 Aedes Broker，开箱即用，支持 TCP/WebSocket，可选账号密码认证
- **MQTT 远程通信** — 通过 MQTT 调用平台全部服务，支持 C2S/S2C 定向响应，适合跨设备/跨进程场景
- **硬件方案（开发中）** — 与子应用 MQTT 联动，通过硬件语音输入控制/远程控制电脑

## 📦 快速开始

```bash
git clone https://github.com/HAJIMI-AI/hajimi.git
cd hajimi
npm install

# 开发模式
npm run dev          # Vite
npm run dev:app      # Electron
```

> 需要 Node.js 18+ 和一个 Claude 兼容的 API Key。

启动后：⚙️ → **模型管理** → 添加模型 → 导入应用即可开始使用。本地 MQTT 服务默认自启动，点击 ⚙️ → 环境设置 即可配置。

### 打包

```bash
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
```

## 🏗️ 架构

```
electron/          # 主进程 (CommonJS)
  main.cjs         # 入口：窗口、托盘、IPC
  eventCenter.cjs  # 服务总线（应用/模型/会话/代理/文件…）
  mqttBroker.cjs   # 本地 MQTT Broker（Aedes）
  logger/          # 运行日志模块（按天轮转、缓冲写、IPC 可查）
  preload.js       # contextBridge
  config/          # 配置文件
src/               # 渲染进程 (React + TypeScript)
  App.tsx          # 主界面
  components/      # UI 组件
  lib/             # 类型 & 辅助函数
```

## 🧩 应用导入

| 模式 | 方式 |
|------|------|
| **本地** | 选择一个含 `hsq.config.json` 的目录 |
| **指纹** | 输入指纹，自动从 CDN 下载 `zip` 并解压 |
| **远程** | 输入 URL，加载远程 `hsq.config.json` 作为入口 |

每个应用需要提供 `hsq.config.json`：

```json
{
  "appId": "my_app",
  "appName": "我的应用",
  "appVersion": "1.0.0",
  "appDescription": "应用描述",
  "mode": "local",
  "gitUrl": "https://github.com/user/repo",
  "dev": false
}
```

> 📂 子应用开发模版：[SUB_APP_TEMPLATE](https://github.com/HAJIMI-AI/SUB_APP_TEMPLATE) — 开箱即用的脚手架，含 `hsq.config.json` 范例与项目结构。

---

## 🔌 API 参考

平台通过 `window.eventCenter` 为子应用提供以下服务。所有服务均自动注入 `appId` 实现数据隔离。

子应用内部调用时，`appId` 由 preload 自动注入，无需手动传入。通过 MQTT 远程调用时，`args[0]` 必须包含 `appId`。

---

### Agent — AI 智能体调用

#### `runAgentWithModel(input)`

一键调用 AI 模型。自动解析模型配置（modelId → 默认模型 → 首个模型）和工作目录。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agentName` | `string` | **必填** | Agent 引擎名称，目前为 `"claude"` |
| `prompt` | `string` | **必填** | 发送给 AI 的提示词 |
| `modelId` | `string` | `undefined` | 指定模型 ID。不传时自动 fallback：当前默认模型 → 模型中第一个 |
| `sessionId` | `string` | `undefined` | 会话 ID，传入可恢复之前的对话 |
| `cwd` | `string` | `undefined` | 工作目录。不传时自动使用当前 app 的工作目录 |
| `allowTools` | `boolean` | `false` | 是否允许 AI 使用工具（读写文件、执行命令等） |
| `collectMessages` | `boolean` | `false` | 是否收集完整消息流（用于调试） |
| `permissionMode` | `string` | `undefined` | 权限模式。如 `"dontAsk"` 自动批准所有操作 |
| `images` | `ImageInput[]` | `undefined` | Vision 图片输入数组 |
| `plugins` | `PluginRef[]` | `undefined` | 插件列表，每项 `{ type: 'local', path: string }` |
| `sdkOptions` | `Record<string, unknown>` | `undefined` | 透传给 Claude Agent SDK 的额外选项（会覆盖自动生成的配置） |

**`ImageInput` 类型：**

```ts
{
  base64: string        // data URL 格式，如 "data:image/png;base64,..."
  detail?: 'auto' | 'low' | 'high'  // 分辨率控制，默认 'auto'
}
```

**返回值 `AgentRunResult`：**

```ts
{
  sessionId: string           // 会话 ID，可用于后续调用恢复对话
  messageId: string           // 本次消息 ID
  ok: boolean                 // 是否成功
  result: string              // AI 返回的文本结果
  stopReason: string | null   // 停止原因（如 "end_turn", "max_turns" 等）
  usage: unknown              // token 用量信息
  totalCostUsd: number | null // 预估费用（美元）
  messages: unknown[] | null  // 完整消息流（collectMessages=true 时返回）
}
```

**模型解析优先级：**

1. 如果传了 `modelId`，直接用该 ID 查模型
2. 否则取当前用户设置的默认模型
3. 否则取模型列表中的第一个
4. 都没有则抛出错误

**示例：**

```ts
// 基础调用（自动使用默认模型和工作目录）
const result = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '帮我分析这段代码的性能瓶颈',
  allowTools: true
})
console.log(result.result)

// 指定模型 + 恢复会话
const result2 = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  modelId: 'my-claude-sonnet',
  sessionId: result.sessionId,  // 继续上一轮对话
  prompt: '针对上面的分析，给出优化方案'
})

// Vision：图片分析
const img = await window.eventCenter.readImageAsBase64({
  path: '/path/to/design.png',
  maxWidth: 2048
})
const result3 = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '根据这张设计图生成对应的 HTML/CSS 代码',
  images: [{ base64: img.base64, detail: 'high' }]
})

// 带插件调用
const result4 = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '帮我把这篇文档翻译成英文',
  allowTools: true,
  plugins: [
    { type: 'local', path: '/path/to/translator-plugin' }
  ]
})

// 高级：透传 SDK 选项 + 自动批准
const result5 = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '重构 src/ 下的所有文件，统一代码风格',
  allowTools: true,
  permissionMode: 'dontAsk',
  sdkOptions: {
    maxTurns: 50,
    model: 'claude-sonnet-4-6'
  }
})
```

---

#### `runAgent(input)`

底层 Agent 调用。与 `runAgentWithModel` 的区别是：**需要手动传入模型配置**（`model`、`api_token`、`api_url`），不会自动解析。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agentName` | `string` | **必填** | Agent 引擎名称 |
| `prompt` | `string` | **必填** | 提示词 |
| `model` | `string` | `undefined` | 模型名称（如 `"claude-sonnet-4-6"`） |
| `api_token` | `string` | `undefined` | API Token（覆盖默认配置） |
| `api_url` | `string` | `undefined` | API 地址（覆盖默认配置） |
| `sessionId` | `string` | `undefined` | 会话 ID，恢复对话 |
| `cwd` | `string` | `undefined` | 工作目录 |
| `allowTools` | `boolean` | `false` | 是否允许使用工具 |
| `collectMessages` | `boolean` | `false` | 是否收集完整消息流 |
| `permissionMode` | `string` | `undefined` | 权限模式 |
| `images` | `ImageInput[]` | `undefined` | Vision 图片输入 |
| `plugins` | `PluginRef[]` | `undefined` | 插件列表 |
| `sdkOptions` | `Record<string, unknown>` | `undefined` | 透传给 SDK 的额外选项 |

**返回值：** 同 `AgentRunResult`

**示例：**

```ts
// 直接指定完整模型信息，不依赖平台配置
const result = await window.eventCenter.runAgent({
  agentName: 'claude',
  prompt: '解释这段代码',
  model: 'claude-sonnet-4-6',
  api_token: 'sk-ant-xxx',
  api_url: 'https://api.anthropic.com'
})
```

---

#### `listAgents()`

列出所有已注册的 Agent 引擎。

**参数：** 无

**返回值：** `{ name: string; description: string }[]`

```ts
const agents = await window.eventCenter.listAgents()
// [{ name: 'claude', description: 'Claude Agent SDK (Claude Code) integration' }]
```

---

### Models — 模型管理

#### `listModels()`

列出当前用户的所有模型配置。

**参数：** 无

**返回值：** `ManagedModelItem[]`

```ts
type ManagedModelItem = {
  id: string          // 模型 ID
  alias: string       // 别名
  name: string        // 模型名称（如 "claude-sonnet-4-6"）
  api_url: string     // API 地址
  api_token: string   // API Token
  createdAt?: number
  updatedAt?: number
}
```

#### `getSelectedModel()`

获取当前用户设置的默认模型。

**参数：** 无

**返回值：** `ManagedModelItem | null`

#### `setSelectedModel(id)`

设置当前用户的默认模型。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string \| null` | 模型 ID。传 `null` 清除默认模型 |

**返回值：** `{ selectedModelId: string | null }`

---

### Apps — 应用管理

#### `listApps(input?)`

获取当前用户的应用列表。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `reload` | `boolean` | `false` | 是否重新解析本地应用的 `hsq.config.json`（远程应用跳过） |

**返回值：** `{ apps: ManagedAppItem[] }`

```ts
type ManagedAppItem = {
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
```

#### `refreshApps()`

刷新应用列表（等同于 `listApps({ reload: true })`）。

**参数：** 无

**返回值：** `{ apps: ManagedAppItem[] }`

#### `importByFingerprint(input)`

通过指纹从 CDN 下载 zip 包导入应用。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `fingerprint` | `string` | 应用指纹（3-128 位字母数字） |
| `alias` | `string` | 应用别名 |
| `overwrite` | `boolean` | 可选，已存在时是否覆盖 |

**返回值：** `{ app: ManagedAppItem }` 或 `{ conflict: true, existingApp: ManagedAppItem }`

#### `importByUrl(input)`

通过远程 URL 导入应用。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | 远程应用 URL |
| `alias` | `string` | 应用别名 |

**返回值：** `{ app: ManagedAppItem }`

#### `focusOrOpenPopup(input)`

打开应用弹窗（已打开则聚焦）。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `appId` | `string` | 应用 ID |
| `pathSuffix` | `string` | 可选，URL 路径后缀 |

**返回值：** `{ ok: true; winId: string; existing: boolean }`

#### `openAppPopup(input)`

强制新建弹窗（即使已有同 appId 窗口）。

**参数：** `{ appId: string }`

**返回值：** `{ ok: true; winId: string }`

#### `replaceWithAppPopup(input)`

关闭当前窗口并打开新的 app 弹窗。

**参数：** `{ appId: string }`

#### `closeCurrentWindow()`

关闭当前窗口。

**参数：** 无

#### `getRunningApps()`

获取正在运行的应用 appId 列表。

**参数：** 无

**返回值：** `{ running: string[] }`

#### `pinApp(input)`

置顶/取消置顶应用。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 应用数据库 ID |
| `pinned` | `boolean` | 是否置顶 |

**返回值：** `{ ok: true; pinned: boolean }`

#### `getAppDetail(input)`

根据 appId 获取应用详情。

**参数：** `{ appId: string }` 或直接传 `string`

**返回值：** `{ app: ManagedAppItem }`

#### `refreshMainAppList()`

子应用安装新应用后通知主窗口刷新列表。

**参数：** 无

**返回值：** `{ ok: true }`

#### `pickDirectory()`

打开系统目录选择器（用于应用管理）。

**参数：** 无

**返回值：** `{ directory: string | null }`

---

### Files — 文件操作

#### `readTextFile(input)`

读取文本文件（限定在应用目录内）。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 相对于应用目录的文件路径 |
| `encoding` | `string` | `"utf8"` | 文件编码 |

**返回值：** `{ ok: true; path: string; content: string }`

```ts
const file = await window.eventCenter.readTextFile({ path: 'data/config.json' })
console.log(file.content)
```

#### `writeTextFile(input)`

写入文本文件（限定在应用目录内）。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 相对于应用目录的文件路径 |
| `content` | `string` | **必填** | 要写入的内容 |
| `encoding` | `string` | `"utf8"` | 文件编码 |
| `overwrite` | `boolean` | `true` | 是否覆盖已存在的文件 |
| `mkdirp` | `boolean` | `true` | 是否自动创建父目录 |

**返回值：** `{ ok: true; path: string }`

#### `readAbsoluteText(input)`

读取任意绝对路径的文本文件（不受应用目录限制）。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 文件绝对路径 |
| `encoding` | `string` | `"utf8"` | 文件编码 |

**返回值：** `ContextFile`

```ts
type ContextFile = {
  path: string    // 文件路径
  content: string // 文件内容
  size: number    // 文件大小（字节）
  name: string    // 文件名
  ext: string     // 扩展名
}
```

#### `readImageAsBase64(input)`

读取图片并转为 base64 data URL。支持 PNG/JPG/WebP/GIF/BMP/SVG，最大 20MB。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 图片绝对路径 |
| `maxWidth` | `number` | `0`（不限制） | 最大宽度，等比缩放 |
| `maxHeight` | `number` | `0`（不限制） | 最大高度，等比缩放 |
| `quality` | `number` | `undefined` | JPEG 质量 0-1（仅对 JPEG 输出生效，默认 0.85） |

**返回值：** `ReadImageResult`

```ts
type ReadImageResult = {
  ok: true
  path: string
  base64: string       // data URL，如 "data:image/png;base64,..."
  mimeType: string     // "image/png" | "image/jpeg" | "image/svg+xml"
  width: number
  height: number
  sizeBytes: number
}
```

#### `writeImageBase64(input)`

将 base64 图片写入应用目录。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 相对于应用目录的文件路径 |
| `base64` | `string` | **必填** | base64 数据（支持 data URL 或纯 base64） |
| `overwrite` | `boolean` | `true` | 是否覆盖已存在的文件 |
| `mkdirp` | `boolean` | `true` | 是否自动创建父目录 |

**返回值：** `{ ok: true; path: string; sizeBytes: number }`

#### `deletePath(input)`

删除文件或目录。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 相对于应用目录的路径 |
| `recursive` | `boolean` | `false` | 删除目录时是否递归删除 |

**返回值：** `{ ok: true; deleted: boolean }`

#### `copyPath(input)`

复制文件。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `from` | `string` | **必填** | 源路径（相对应用目录） |
| `to` | `string` | **必填** | 目标路径（相对应用目录） |
| `overwrite` | `boolean` | `true` | 是否覆盖已存在的目标文件 |
| `mkdirp` | `boolean` | `true` | 是否自动创建目标父目录 |

**返回值：** `{ ok: true; from: string; to: string }`

#### `movePath(input)`

移动/重命名文件。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `from` | `string` | **必填** | 源路径 |
| `to` | `string` | **必填** | 目标路径 |
| `overwrite` | `boolean` | `true` | 是否覆盖已存在的目标 |
| `mkdirp` | `boolean` | `true` | 是否自动创建目标父目录 |

**返回值：** `{ ok: true; from: string; to: string }`

#### `pickFiles(input?)`

打开系统文件选择器。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filters` | `{ name: string; extensions: string[] }[]` | `[{ name: 'All Files', extensions: ['*'] }]` | 文件类型过滤器 |
| `multi` | `boolean` | `true` | 是否允许多选 |

**返回值：** `{ files: string[] }`

```ts
const { files } = await window.eventCenter.pickFiles({
  filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }],
  multi: false
})
```

#### `pickWorkingDirectory()`

打开目录选择器。

**参数：** 无

**返回值：** `{ directory: string | null }`

#### `previewFile(input)`

文件预览，自动识别类型（图片/文本/二进制）。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | `string` | **必填** | 文件绝对路径 |
| `maxTextBytes` | `number` | `524288`（512KB） | 文本预览最大字节数，上限 2MB |
| `maxImageDim` | `number` | `0`（不缩放） | 图片预览最大尺寸 |

**返回值：** `FilePreviewResult`

```ts
type FilePreviewResult = {
  type: 'text' | 'image' | 'binary'
  path: string
  name: string
  ext: string
  sizeBytes: number

  // type='text' 时有以下字段：
  content?: string       // 文本内容
  language?: string      // 语言标识（如 "typescript", "python"）
  truncated?: boolean    // 内容是否被截断

  // type='image' 时有以下字段：
  base64?: string        // data URL
  mimeType?: string
  width?: number
  height?: number
}
```

#### `previewFileDialog(input)`

在独立窗口中预览文件。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | 文件绝对路径 |
| `title` | `string` | 可选，窗口标题，默认用文件名 |

**返回值：** `{ ok: true }`

#### `showItemInFolder(input)`

在系统文件管理器中定位文件。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 文件绝对路径 |

**返回值：** `{ ok: true }`

---

### Storage — 应用 KV 存储

以 `userKey + appId` 隔离的键值存储，值可以是任意 JSON。

#### `storageGet(input)`

读取键值。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 键名 |

**返回值：** `{ exists: boolean; value: unknown }`

```ts
const { exists, value } = await window.eventCenter.storageGet({ key: 'theme' })
if (exists) {
  console.log(value)  // { mode: 'dark' }
}
```

#### `storageSet(input)`

写入键值。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 键名 |
| `value` | `any` | 值（任意 JSON 可序列化的数据） |

**返回值：** `{ ok: true }`

#### `storageRemove(input)`

删除键值。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 键名 |

**返回值：** `{ ok: true }`

#### `storageList(input)`

按前缀列出键值。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefix` | `string` | `""`（全部） | 键名前缀过滤 |

**返回值：** `{ items: { key: string; value: unknown }[] }`

---

### Profile — 本地账户

#### `setLocalProfile(input)`

创建或更新本地账户。创建时 `userKey` 唯一校验。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `userKey` | `string` | 可选，不传则自动生成 |
| `nickname` | `string` | 昵称 |
| `avatar` | `string` | 可选，头像 base64 |

**返回值：** `{ userKey: string; nickname: string; avatar: string | null }`

#### `getLocalProfile(userKey?)`

获取账户信息。不传 `userKey` 则获取当前登录账户。

**参数：** `string | { userKey?: string }`

**返回值：** `LocalProfile`

```ts
type LocalProfile = {
  exists: boolean
  userKey: string
  nickname: string | null
  avatar: string | null
}
```

#### `listProfiles()`

列出所有本地账户。

**参数：** 无

**返回值：** `{ profiles: ProfileItem[] }`

```ts
type ProfileItem = {
  userKey: string
  nickname: string
  avatar: string | null
  updatedAt: number | null
}
```

#### `switchProfile(input)`

切换账户。数据自动隔离，MQTT 自动以新 userKey 重连。新账户未配 MQTT 则断开。

**参数：** `string | { userKey: string }`

**返回值：** `{ userKey: string; nickname: string; avatar: string | null }`

#### `signOut()`

退出登录（清空 userKey，断开 MQTT 连接）。

**参数：** 无

**返回值：** `{ ok: true }`

#### `deleteProfile(input)`

删除账户及全部数据（模型、应用、KV、MQTT 配置、工作目录等）。当前账户则先登出。

**参数：** `string | { userKey: string }`

**返回值：** `{ ok: true }`

---

### Skills — 技能管理

#### `listSkills(input?)`

列出可用技能。子应用自动按 scope 过滤。

**参数：** `object`（可选，预留扩展）

**返回值：** `SkillItem[]`

```ts
type SkillItem = {
  id: string
  name: string
  scope: 'shared' | string   // 'shared' 或特定 appId
  directory: string
  sourceDirectory: string
  fileCount: number
  createdAt: number
  updatedAt: number
}
```

#### `uploadSkill(input)`

上传技能（复制目录到 userData）。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 可选，技能名称 |
| `sourceDirectory` | `string` | 技能源目录绝对路径 |

**返回值：** `SkillItem`

#### `uploadSkills(input)`

批量上传技能。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `items` | `{ name?: string; sourceDirectory: string }[]` | 技能列表 |

**返回值：** `{ skills: SkillItem[]; errors: { sourceDirectory: string; name: string; error: string }[] }`

#### `scanSkillDirs(input)`

扫描目录下可导入的技能目录。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `parentDirectory` | `string` | 父目录路径 |

**返回值：** `{ directories: { name: string; path: string; hasSkillMd: boolean; fileCount: number }[] }`

#### `updateSkill(input)`

更新技能名称。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 技能 ID |
| `name` | `string` | 新名称 |

**返回值：** `SkillItem`

#### `deleteSkill(input)`

删除技能。

**参数：** `{ id: string }`

**返回值：** `{ ok: true }`

#### `getSkillPluginPath(id)`

获取技能插件路径（可直接传入 Agent）。

**参数：** `id: string`

**返回值：** `{ path: string }`

#### `readSkillMd(input)`

读取技能目录下的 SKILL.md 文件。

**参数：** `{ id: string }`

**返回值：** `{ path: string; content: string; frontmatter: Record<string, string> }`

---

### Plugin Packs — 插件包

插件包将多个技能 + MCP 配置打包组合。

```ts
type PluginPackItem = {
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
```

#### `listPluginPacks(input?)`

列出插件包。

**参数：** `object`（可选）

**返回值：** `PluginPackItem[]`

#### `createPluginPack(input)`

创建插件包。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 插件包名称 |
| `description` | `string` | 可选，描述 |
| `skillIds` | `string[]` | 包含的技能 ID 列表 |
| `mcpConfigIds` | `string[]` | 可选，包含的 MCP 配置 ID 列表 |

**返回值：** `PluginPackItem`

#### `updatePluginPack(input)`

更新插件包。

**参数：** 所有字段可选，传了就更新。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | **必填**，插件包 ID |
| `name` | `string` | 可选，新名称 |
| `description` | `string` | 可选，新描述 |
| `skillIds` | `string[]` | 可选，新技能列表 |
| `mcpConfigIds` | `string[]` | 可选，新 MCP 配置列表 |

**返回值：** `PluginPackItem`

#### `deletePluginPack(input)`

删除插件包。

**参数：** `{ id: string }`

**返回值：** `{ ok: true }`

#### `getPackPluginPath(id)`

获取插件包路径（可直接传入 Agent）。

**参数：** `id: string`

**返回值：** `{ path: string }`

---

### MCP Configs — MCP 配置

```ts
type McpConfigItem = {
  id: string
  name: string
  description: string
  scope: 'shared' | string
  config: object         // MCP 服务器配置对象
  directory: string
  createdAt: number
  updatedAt: number
}
```

#### `listMcpConfigs(input?)`

列出 MCP 配置。

**参数：** `object`（可选）

**返回值：** `McpConfigItem[]`

#### `createMcpConfig(input)`

创建 MCP 配置。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 配置名称 |
| `description` | `string` | 可选，描述 |
| `config` | `object` | MCP 服务器配置对象 |

**返回值：** `McpConfigItem`

#### `updateMcpConfig(input)`

更新 MCP 配置。

**参数：** 所有字段可选。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | **必填**，配置 ID |
| `name` | `string` | 可选 |
| `description` | `string` | 可选 |
| `config` | `object` | 可选 |

**返回值：** `McpConfigItem`

#### `deleteMcpConfig(input)`

删除 MCP 配置。

**参数：** `{ id: string }`

**返回值：** `{ ok: true }`

#### `getMcpConfig(input)`

获取单个 MCP 配置详情。

**参数：** `{ id: string }`

**返回值：** `McpConfigItem`

#### `getMcpConfigsByIds(input)`

批量获取 MCP 配置。

**参数：** `{ ids: string[] }`

**返回值：** `McpConfigItem[]`

#### `getMcpPluginPath(id)`

获取 MCP 插件路径（可直接传入 Agent）。

**参数：** `id: string`

**返回值：** `{ path: string }`

---

### Proxy — HTTP 代理

#### `proxyFetch(input)`

通过主进程代理 HTTP 请求，绕过浏览器的 CORS / 混合内容限制。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | `string` | **必填** | 请求 URL |
| `method` | `string` | `"GET"` | HTTP 方法（GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS） |
| `headers` | `Record<string, string>` | `{}` | 请求头 |
| `body` | `string` | `undefined` | 请求体字符串 |
| `timeoutMs` | `number` | `30000` | 超时毫秒数，上限 120000 |

**返回值：** `ProxyFetchResult`

```ts
type ProxyFetchResult = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}
```

**示例：**

```ts
const res = await window.eventCenter.proxyFetch({
  url: 'https://api.example.com/data',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
  timeoutMs: 10000
})
if (res.ok) {
  const data = JSON.parse(res.body)
  console.log(data)
}
```

---

### System — 系统能力

#### `getClientConfig()`

获取本机运行时配置。

**参数：** 无

**返回值：** `ClientConfig`

```ts
type ClientConfig = {
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
```

#### `getUserKey()`

获取当前登录的 userKey。

**参数：** 无

**返回值：** `string`

#### `getAppId()`

获取当前窗口的 appId。主窗口返回 `null`。

**参数：** 无

**返回值：** `string | null`

#### `getAppWorkdir(appId?)`

获取应用工作目录。

**参数：** `appId?: string | null` — 不传则用当前窗口的 appId

**返回值：** `{ workdir: string; isDefault: boolean }`

#### `setAppWorkdir(input)`

设置应用工作目录。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `appId` | `string` | 可选，不传用当前窗口 appId |
| `directory` | `string` | 新工作目录路径 |

**返回值：** `{ workdir: string }`

#### `getDevMode()` / `setDevMode(enabled)`

获取/设置开发者模式。

**`getDevMode()`：** 无参数，返回 `boolean`

**`setDevMode(enabled)`：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `enabled` | `boolean` | 是否开启开发者模式 |

**返回值：** `{ devMode: boolean }`

#### `openInBrowser(input)`

用系统默认浏览器打开 URL。仅允许 `http://` 和 `https://` 协议。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | 要打开的 URL |

**返回值：** `{ ok: true }`

#### `openExternalApp(input)`

用系统默认程序打开文件或目录。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 文件或目录路径 |

**返回值：** `{ ok: true }`

#### `openExternalAppByName(input)`

按应用名启动应用。

- **macOS**: 搜索 `/Applications` 下 `<name>.app`（支持模糊匹配），fallback 到 `open -a`
- **Windows**: 使用 `start` 命令

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 应用名称（如 `"微信"`, `"Safari"`） |

**返回值：** `{ ok: true; path?: string }`

#### `showMain()`

显示/聚焦主窗口。

**参数：** 无

**返回值：** `{ ok: true }`

#### `quit()`

退出应用。

**参数：** 无

#### `listServices()`

查看所有已注册的服务与方法。

**参数：** 无

**返回值：** `Record<string, string[]>` — `{ serviceName: ['method1', 'method2', ...] }`

#### `getEventMode()` / `setEventMode(input)`

获取/设置事件通信模式（ipc / mqtt / both）。

**`getEventMode()`：** 无参数，返回 `'ipc' | 'mqtt' | 'both'`

**`setEventMode(input)`：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `mode` | `string` | `"ipc"`, `"mqtt"`, `"both"` |
| `url` | `string` | MQTT Broker 地址（mqtt 模式必填） |
| `username` | `string` | 可选，MQTT 用户名 |
| `password` | `string` | 可选，MQTT 密码 |

---

### Cross-Window Events — 跨窗口通信

#### `sendAppEvent(targetAppId, eventName, data?)`

向指定 app 窗口发送事件。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `targetAppId` | `string` | 目标应用的 appId |
| `eventName` | `string` | 事件名称 |
| `data` | `unknown` | 可选，事件数据 |

**返回值：** `{ ok: true }`

#### `broadcastAppEvent(eventName, data?)`

向所有 app 窗口广播事件。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `eventName` | `string` | 事件名称 |
| `data` | `unknown` | 可选，事件数据 |

**返回值：** `{ ok: true; sent: number }` — `sent` 为接收窗口数

---

### MQTT Broker — 本地 MQTT 服务

内置 [Aedes](https://github.com/moscajs/aedes) Broker，开箱即用，无需额外安装服务。

#### `getMqttBrokerStatus()`

获取运行状态。

**参数：** 无

**返回值：** `MqttBrokerStatus`

```ts
type MqttBrokerStatus = {
  running: boolean
  port: number
  wsPort: number
  wsUrl: string | null      // 如 "ws://localhost:1884"
  tcpUrl: string | null     // 如 "mqtt://localhost:1883"
  wsEnabled: boolean
  hasAuth: boolean
  clientCount: number
}
```

#### `getMqttBrokerConfig()`

获取持久化配置。

**参数：** 无

**返回值：** `MqttBrokerConfig`

```ts
type MqttBrokerConfig = {
  enabled: boolean    // 是否自启动
  port: number        // TCP 端口
  wsEnabled: boolean  // 是否启用 WebSocket
  wsPort: number      // WebSocket 端口
  username: string    // 认证用户名（空字符串表示不认证）
  hasAuth: boolean    // 是否已配置认证
}
```

#### `updateMqttBrokerConfig(input)`

更新配置，自动重启服务应用新设置。

**参数：** 所有字段可选：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否自启动 |
| `port` | `number` | `1883` | TCP 端口 |
| `wsEnabled` | `boolean` | `true` | 是否启用 WebSocket |
| `wsPort` | `number` | `1884` | WebSocket 端口 |
| `username` | `string` | `""` | 认证用户名（留空不认证） |
| `password` | `string` | `""` | 认证密码（留空不认证） |

**返回值：** `{ config: MqttBrokerConfig }`

#### `startMqttBroker()`

手动启动服务。

**参数：** 无

**返回值：** `MqttBrokerStatus & { ok: boolean; alreadyRunning?: boolean }`

#### `stopMqttBroker()`

手动停止服务。

**参数：** 无

**返回值：** `{ ok: boolean; alreadyStopped?: boolean }`

#### `listMqttBrokerClients()`

查看当前连接的客户端列表。

**参数：** 无

**返回值：** `{ clients: MqttBrokerClient[] }`

```ts
type MqttBrokerClient = {
  id: string
  address: string
  connectedAt: number
}
```

**使用示例：**

```ts
// 检查服务状态
const status = await window.eventCenter.getMqttBrokerStatus()
// { running: true, port: 1883, tcpUrl: "mqtt://localhost:1883", clientCount: 2 }

// 配置认证
await window.eventCenter.updateMqttBrokerConfig({
  username: 'admin',
  password: 'mysecret'
})
// 服务自动重启，之后客户端需提供账号密码才能连接

// 查看已连接客户端
const { clients } = await window.eventCenter.listMqttBrokerClients()
```

上层应用通过 `mqtt://localhost:1883` (TCP) 或 `ws://localhost:1884` (WebSocket) 连接。

---

### MQTT 远程通信模式

切换到 MQTT 模式后，外部应用可通过 MQTT Broker 调用平台全部服务，无需 Electron IPC。每个响应定向发送到调用者独有的 topic，实现多客户端天然隔离。

#### 架构

```
外部 App A (appId: chat-app, appUserId: user-a)    外部 App B (appId: code-app, appUserId: user-b)
│ 订阅: alice/chat-app/user-a/response/s2c         │ 订阅: alice/code-app/user-b/response/s2c
│                                                   │
▼                                                   ▼
┌─────────────────────────────────────────────────────────┐
│              MQTT Broker (localhost:1883)                │
│                                                         │
│  alice/request  ← 所有请求发到这里                         │
│  alice/chat-app/user-a/response/s2c → 只给 A             │
│  alice/code-app/user-b/response/s2c → 只给 B             │
└────────────────────┬────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │   Hajimi    │ setupMQTT() 订阅 alice/request
              │  (主进程)    │ 处理完后 publish 到各自 response topic
              └─────────────┘
```

#### 启用步骤

1. 在 `electron/policy.cjs` 中确保 `mqtt.enabled = true`
2. 打开 Hajimi → ⚙️ **环境设置** → 选择 **MQTT 模式**
3. 填写 MQTT Broker 地址（如 `mqtt://localhost:1883`）→ **测试连接**
4. 保存，下次打开环境设置自动恢复 MQTT 状态

#### 请求消息格式

发布到 `{userKey}/request`：

```json
{
  "id": "req-001",
  "appUserId": "user-abc",
  "service": "modules",
  "method": "listModels",
  "args": [{ "appId": "my-app" }],
  "deviceCode": "my-device",
  "timestamp": 1700000000000
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` | string | | 请求追踪 ID |
| `appUserId` | string | ✅ | 用户标识，作为响应 topic 组成部分 |
| `service` | string | ✅ | 服务名 |
| `method` | string | ✅ | 方法名 |
| `args` | array | ✅ | 参数列表，第一项为 `{ appId: "xxx" }` |
| `deviceCode` | string | | 设备标识 |
| `timestamp` | number | | 请求时间戳（毫秒） |

#### 响应消息格式

- **成功：** `{ "id": "...", "ok": true, "result": ... }`
- **失败：** `{ "id": "...", "ok": false, "error": { "name": "...", "message": "..." } }`

#### Topic 规则

| 角色 | Topic |
|------|-------|
| **请求**（客户端 → Hajimi） | `{userKey}/request` |
| **响应**（Hajimi → 客户端） | `{userKey}/{appId}/{appUserId}/response/s2c` |

> 🧪 MQTT 测试与 API 示例：[HAJIMI_MQTT_TEST](https://github.com/HAJIMI-AI/HAJIMI_MQTT_TEST) — 包含完整 MQTT 调用测试脚本和服务速查。

#### 快速开始（Node.js）

```js
const mqtt = require('mqtt')

const USER_KEY = 'alice'      // 当前 Hajimi 登录的 userKey
const APP_ID = 'my-app'
const APP_USER_ID = 'user-abc'

const client = mqtt.connect('mqtt://localhost:1883')

client.on('connect', () => {
  // 订阅自己的专属响应 topic
  client.subscribe(`${USER_KEY}/${APP_ID}/${APP_USER_ID}/response/s2c`)

  // 获取模型列表
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-001',
    appUserId: APP_USER_ID,
    service: 'modules',
    method: 'listModels',
    args: [{ appId: APP_ID }]
  }))

  // Agent 调用（不传模型 → 自动用默认模型或第一个；不传 cwd → 自动用 app 工作目录）
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-004',
    appUserId: APP_USER_ID,
    service: 'agent',
    method: 'runAgentWithModel',
    args: [{
      appId: APP_ID,
      agentName: 'claude',
      prompt: '帮我分析这段代码',
      allowTools: true
    }]
  }))

  // KV 存储写入
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-005',
    appUserId: APP_USER_ID,
    service: 'appStorage',
    method: 'set',
    args: [{ appId: APP_ID, key: 'theme', value: { mode: 'dark' } }]
  }))

  // 默认浏览器打开 URL
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-006',
    appUserId: APP_USER_ID,
    service: 'app',
    method: 'openInBrowser',
    args: [{ appId: APP_ID, url: 'https://example.com' }]
  }))

  // 打开本机应用
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-007',
    appUserId: APP_USER_ID,
    service: 'app',
    method: 'openExternalAppByName',
    args: [{ appId: APP_ID, name: '微信' }]
  }))
})

client.on('message', (topic, raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.ok) {
    console.log('✅ 成功:', msg.id, msg.result)
  } else {
    console.error('❌ 失败:', msg.id, msg.error)
  }
})
```

#### MQTT 可调用服务一览

| service | 常用方法 | 说明 |
|---------|---------|------|
| `modules` | `listModels` `getModel` `createModel` `updateModel` `deleteModel` `getSelectedModel` `setSelectedModel` `testModelConnection` | 模型管理 |
| `apps` | `list` `create` `open` `openPopup` `remove` `getRunning` `pin` `pickDirectory` `importByFingerprint` `importByUrl` `getByAppId` `getAppWorkdir` `setAppWorkdir` | 应用管理 |
| `profile` | `list` `get` `set` `delete` `switchTo` `signOut` | 本地账户 |
| `agent` | `listAgents` `runAgent` `runAgentWithModel` | AI 智能体调用 |
| `app` | `showMain` `quit` `openInBrowser` `openExternalApp` `openExternalAppByName` `previewFileDialog` | 系统操作 |
| `appStorage` | `get` `set` `remove` `list` | 应用 KV 存储 |
| `files` | `readText` `writeText` `delete` `copy` `move` `readAbsoluteText` `readImageAsBase64` `writeImageBase64` `pickFiles` `previewFile` `showItemInFolder` `pickWorkingDirectory` | 文件操作 |
| `skills` | `listSkills` `uploadSkill` `uploadSkills` `scanSkillDirs` `updateSkill` `deleteSkill` `getPluginPath` `readSkillMd` | 技能管理 |
| `pluginPacks` | `listPluginPacks` `createPluginPack` `updatePluginPack` `deletePluginPack` `getPluginPath` | 插件包 |
| `mcpConfigs` | `listMcpConfigs` `createMcpConfig` `updateMcpConfig` `deleteMcpConfig` `getMcpConfig` `getMcpConfigsByIds` `getMcpPluginPath` | MCP 配置 |
| `proxy` | `fetch` | HTTP 代理 |
| `mqttBroker` | `start` `stop` `getStatus` `getConfig` `updateConfig` `listClients` | 本地 Broker 管理 |
| `eventCenter` | `listServices` `getClientConfig` `getEventMode` `setEventMode` `getMqttConfig` `setMqttConfig` `testMqttConnection` | 系统信息 |

> `testMqttConnection` 可通过 MQTT 测试 Broker 连通性：`{ "service": "eventCenter", "method": "testMqttConnection", "args": [{ "appId": "xxx", "url": "mqtt://...", "username": "...", "password": "..." }] }`

> 所有服务的 `args[0]` 必须包含 `appId`，否则消息静默丢弃。

#### 注意事项

- **appId 与 appUserId 必填** — 缺任一字段，消息静默丢弃，不回复
- **Topic 级隔离** — 每个 `appId + appUserId` 享有独立响应 topic，无法被其他客户端订阅
- **认证建议** — 为 Broker 配置账号密码防局域网未授权访问
- **JSON 格式错误** — 无法解析的消息静默丢弃
- **账号切换** — 切换时 MQTT 自动以新 userKey 重连；新账户未配 MQTT 则断开
- **账号删除** — 清空该账户全部数据（MQTT 配置、应用、模型、KV 存储等）；当前账户则先登出并断开 MQTT

---

## 📖 快速示例

```ts
// 本地 MQTT 服务
const status = await window.eventCenter.getMqttBrokerStatus()
await window.eventCenter.updateMqttBrokerConfig({ port: 1885, username: 'admin', password: 'secret' })

// Agent 基础调用（自动解析默认模型和工作目录）
const result = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '帮我分析这段代码',
  allowTools: true
})

// 指定模型 + 恢复会话
const result2 = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  modelId: 'my-claude-sonnet',
  sessionId: result.sessionId,
  prompt: '继续优化上面的方案'
})

// Vision
const img = await window.eventCenter.readImageAsBase64({ path: '/design.png', maxWidth: 2048 })
await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '根据设计图生成代码',
  images: [{ base64: img.base64, detail: 'high' }]
})

// 带插件
await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '翻译这篇文档',
  plugins: [{ type: 'local', path: '/path/to/plugin' }]
})

// HTTP 代理（绕过 CORS）
const res = await window.eventCenter.proxyFetch({
  url: 'https://api.example.com/data',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
  timeoutMs: 5000
})

// 多账户切换
const { profiles } = await window.eventCenter.listProfiles()
await window.eventCenter.switchProfile({ userKey: profiles[0].userKey })

// 文件操作
await window.eventCenter.writeTextFile({ path: 'data/cache.json', content: '{}' })
const { content } = await window.eventCenter.readTextFile({ path: 'data/cache.json' })
await window.eventCenter.storageSet({ key: 'lastAccess', value: Date.now() })
```

> 📚 完整类型定义见 [src/lib/eventCenter.ts](src/lib/eventCenter.ts)

---

## ⚙️ 配置

`electron/config/` 支持环境变量覆盖：

| 配置 | 文件 | 环境变量 |
|------|------|----------|
| CDN / API 地址 | `urls.json` | `CDN_BASE` `UNI_ID_CO_URL` |
| 内置种子应用 | `seeded-apps.json` | `SEEDED_APPS` |

```bash
CDN_BASE="https://raw.githubusercontent.com/user/repo/main/apps" npm start
```

优先级：**环境变量 > JSON 文件**。

## 🤝 贡献

```bash
git clone https://github.com/HAJIMI-AI/hajimi.git
cd hajimi && npm install
npm run dev        # 终端 1: Vite
npm run dev:app    # 终端 2: Electron
```

提交前确保 `npx tsc --noEmit` 通过。

## 📄 License

[MIT](LICENSE)
