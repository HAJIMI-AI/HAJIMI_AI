<h1 align="center">🐱 哈基米 (Hajimi)</h1>
<p align="center"><strong>AI 应用平台</strong> — 封装智能体调用、技能/模型管理，自由组合不同技能与模型，打造你的本地 AI 工作站。</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img src="https://img.shields.io/badge/electron-33%2B-9feaf9" />
  <img src="https://img.shields.io/badge/react-18-61dafb" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

## ✨ 功能

目前只支持claude agent sdk 后续支持更多agent。

- **多模型管理** — 接入 Claude 等兼容 API，统一管理多个模型配置
- **技能系统** — 上传 Claude Agent Skills，组装为插件包，随意组合
- **应用管理** — 本地/远程/指纹三种方式导入应用，同一 appId 单实例窗口
- **多账户** — 本地账户系统，每个账户独立隔离（应用、模型、会话、KV）
- **Agent 引擎** — 内置 Claude Agent SDK，支持 Vision、文件上下文、插件注入
- **HTTP 代理** — `proxyFetch` 主进程代理，绕过 CORS / 混合内容限制
- **MCP 支持** — MCP 配置作为独立 Claude 插件使用，也可合并到插件包
- **本地 MQTT 服务** — 内置 Aedes Broker，开箱即用，支持 TCP/WebSocket，可选账号密码认证
- **MQTT 远程通信** — 通过 MQTT 调用平台全部服务，支持 C2S/S2C 定向响应，适合跨设备/跨进程场景
- **硬件方案（开发中）** — 与子应用 MQTT 联动，通过硬件语音输入控制/远程控制电脑。硬件端采集语音 → MQTT → 子应用 → Agent 执行操作 → 反馈结果

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

## 🔌 平台服务

平台通过 `window.eventCenter` 为子应用提供以下服务，所有服务均自动注入 `appId` 实现数据隔离：

### Agent — AI 智能体调用

| 方法 | 说明 |
|------|------|
| `runAgentWithModel(input)` | 一键调用，自动解析模型（modelId → 默认 → 首个）和工作目录 |
| `runAgent(input)` | 底层调用，需自行传入完整模型配置（`agentName` `api_url` `api_token` 等） |
| `listAgents()` | 列出已注册的 Agent 引擎 |

> `runAgentWithModel` 不传模型时自动 fallback：指定 modelId → 当前默认模型 → 列表中第一个。不传 cwd 时自动用 app 工作目录。

### Apps — 应用管理

| 方法 | 说明 |
|------|------|
| `listApps()` | 获取应用列表 |
| `refreshApps()` | 刷新应用列表 |
| `focusOrOpenPopup(input)` | 打开应用弹窗（已打开则聚焦，远程应用自动刷新缓存） |
| `openAppPopup(input)` | 新建弹窗 |
| `replaceWithAppPopup(input)` | 关闭当前窗口并打开新弹窗 |
| `closeCurrentWindow()` | 关闭当前窗口 |
| `getRunningApps()` | 获取运行中的应用列表 |
| `pinApp(input)` | 置顶/取消置顶应用 |
| `refreshMainAppList()` | 子应用安装新应用后通知主窗口刷新 |

### Files — 文件操作

| 方法 | 说明 |
|------|------|
| `readAbsoluteText(input)` | 读取任意绝对路径文本文件 |
| `readImageAsBase64(input)` | 读取图片转 base64（支持缩放） |
| `writeTextFile(input)` | 写入文本文件（限定应用目录） |
| `readTextFile(input)` | 读取文本文件（限定应用目录） |
| `writeImageBase64(input)` | 写入 base64 图片到应用目录 |
| `deletePath(input)` | 删除文件/目录 |
| `copyPath(input)` | 复制文件 |
| `movePath(input)` | 移动/重命名 |
| `pickFiles(input?)` | 打开系统文件选择器 |
| `pickWorkingDirectory()` | 打开目录选择器 |
| `pickDirectory()` | 打开目录选择器（用于应用管理） |
| `previewFile(input)` | 文件预览（自动识别图片/文本/代码） |
| `previewFileDialog(input)` | 独立窗口预览文件 |
| `showItemInFolder(input)` | 系统文件管理器中定位文件 |

### Storage — 应用 KV 存储

| 方法 | 说明 |
|------|------|
| `storageGet(input)` | 读取键值 |
| `storageSet(input)` | 写入键值（任意 JSON） |
| `storageRemove(input)` | 删除键值 |
| `storageList(input)` | 按前缀列出键值 |

### Models — 模型管理

| 方法 | 说明 |
|------|------|
| `listModels()` | 列出所有模型配置 |
| `getSelectedModel()` | 获取当前默认模型 |
| `setSelectedModel(id)` | 设置默认模型 |

### Profile — 本地账户

| 方法 | 说明 |
|------|------|
| `setLocalProfile(input)` | 创建/更新本地账户（创建时 userKey 唯一校验） |
| `getLocalProfile(userKey?)` | 获取账户信息 |
| `listProfiles()` | 列出所有本地账户 |
| `switchProfile(input)` | 切换账户（数据自动隔离，MQTT 自动以新 userKey 重连，新账户未配 MQTT 则断开） |
| `signOut()` | 退出登录（清空 userKey，断开 MQTT） |
| `deleteProfile(input)` | 删除账户及全部数据（模型、应用、KV、MQTT 配置、工作目录等），当前账户则先登出 |

### Skills — 技能管理

| 方法 | 说明 |
|------|------|
| `listSkills()` | 列出可用技能（子应用自动按 scope 过滤） |
| `uploadSkill(input)` | 上传技能（复制目录到 userData） |
| `deleteSkill(input)` | 删除技能 |
| `getSkillPluginPath(id)` | 获取技能插件路径（可直接传入 Agent） |

### Plugin Packs — 插件包

| 方法 | 说明 |
|------|------|
| `listPluginPacks()` | 列出插件包 |
| `createPluginPack(input)` | 创建插件包（组装技能 + MCP 配置） |
| `updatePluginPack(input)` | 更新插件包 |
| `deletePluginPack(input)` | 删除插件包 |
| `getPackPluginPath(id)` | 获取插件包路径（可直接传入 Agent） |

### MCP Configs — MCP 配置

| 方法 | 说明 |
|------|------|
| `listMcpConfigs()` | 列出 MCP 配置 |
| `createMcpConfig(input)` | 创建 MCP 配置 |
| `updateMcpConfig(input)` | 更新 MCP 配置 |
| `deleteMcpConfig(input)` | 删除 MCP 配置 |
| `getMcpPluginPath(id)` | 获取 MCP 插件路径（可直接传入 Agent） |

### MQTT Broker — 本地 MQTT 服务

内置 [Aedes](https://github.com/moscajs/aedes) Broker，开箱即用，无需额外安装服务。

| 方法 | 说明 |
|------|------|
| `getMqttBrokerStatus()` | 获取运行状态（端口、客户端数、认证状态等） |
| `getMqttBrokerConfig()` | 获取持久化配置（端口、用户名、启用状态） |
| `updateMqttBrokerConfig(input)` | 更新配置，自动重启服务应用新设置 |
| `startMqttBroker()` | 手动启动服务 |
| `stopMqttBroker()` | 手动停止服务 |
| `listMqttBrokerClients()` | 查看当前连接的客户端列表 |

**配置项：**

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 是否自启动 |
| `port` | number | `1883` | TCP 端口 |
| `wsEnabled` | boolean | `true` | 是否启用 WebSocket |
| `wsPort` | number | `1884` | WebSocket 端口 |
| `username` | string | `""` | 认证用户名（留空不认证） |
| `password` | string | `""` | 认证密码（留空不认证） |

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

// 测试 MQTT 远程连接
const result = await window.eventCenter.testMqttConnection({ url: 'mqtt://localhost:1883' })
// { ok: true, latencyMs: 12 } — 连接成功
```

上层应用通过 `mqtt://localhost:1883` (TCP) 或 `ws://localhost:1884` (WebSocket) 连接。

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

```json
// 发布到 {userKey}/request
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

**成功：** `{ "id": "...", "ok": true, "result": ... }`
**失败：** `{ "id": "...", "ok": false, "error": { "name": "...", "message": "..." } }`

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

  // 获取账户列表
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-002',
    appUserId: APP_USER_ID,
    service: 'profile',
    method: 'list',
    args: [{ appId: APP_ID }]
  }))

  // 获取应用列表
  client.publish(`${USER_KEY}/request`, JSON.stringify({
    id: 'req-003',
    appUserId: APP_USER_ID,
    service: 'apps',
    method: 'list',
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
| `modules` | `listModels` `getModel` `createModel` `updateModel` `deleteModel` `getSelectedModel` `setSelectedModel` | 模型管理 |
| `apps` | `list` `create` `open` `openPopup` `remove` `getRunning` `pin` | 应用管理 |
| `profile` | `list` `get` `set` `delete` `switchTo` `signOut` | 本地账户 |
| `agent` | `listAgents` `runAgent` `runAgentWithModel` | AI 智能体调用 |
| `app` | `showMain` `quit` `openInBrowser` `openExternalApp` `openExternalAppByName` | 系统操作 |
| `appStorage` | `get` `set` `remove` `list` | 应用 KV 存储 |
| `files` | `readText` `writeText` `readImageAsBase64` `pickFiles` `previewFile` | 文件操作 |
| `skills` | `listSkills` `uploadSkill` `deleteSkill` `getSkillPluginPath` | 技能管理 |
| `pluginPacks` | `listPluginPacks` `createPluginPack` `updatePluginPack` `deletePluginPack` `getPackPluginPath` | 插件包 |
| `mcpConfigs` | `listMcpConfigs` `createMcpConfig` `updateMcpConfig` `deleteMcpConfig` `getMcpPluginPath` | MCP 配置 |
| `proxy` | `fetch` | HTTP 代理 |
| `mqttBroker` | `start` `stop` `getStatus` `getConfig` `updateConfig` `listClients` | 本地 Broker 管理 |
| `eventCenter` | `listServices` `getEventMode` `getClientConfig` `testMqttConnection` | 系统信息 |

> `testMqttConnection` 可通过 MQTT 测试 Broker 连通性：`{ "service": "eventCenter", "method": "testMqttConnection", "args": [{ "appId": "xxx", "url": "mqtt://...", "username": "...", "password": "..." }] }`

> 所有服务的 `args[0]` 必须包含 `appId`，否则消息静默丢弃。这些方法只解构自己需要的字段，多余的 `appId` 不影响使用。

#### 注意事项

- **appId 与 appUserId 必填** — 缺任一字段，消息静默丢弃，不回复
- **Topic 级隔离** — 每个 `appId + appUserId` 享有独立响应 topic，无法被其他客户端订阅
- **认证建议** — 为 Broker 配置账号密码防局域网未授权访问
- **JSON 格式错误** — 无法解析的消息静默丢弃
- **账号切换** — 切换时 MQTT 自动以新 userKey 重连；新账户未配 MQTT 则断开
- **账号删除** — 清空该账户全部数据（MQTT 配置、应用、模型、KV 存储等）；当前账户则先登出并断开 MQTT

### Proxy — HTTP 代理

| 方法 | 说明 |
|------|------|
| `proxyFetch(input)` | 主进程代理 HTTP 请求，绕过浏览器 CORS / 混合内容限制 |

### System — 系统能力

| 方法 | 说明 |
|------|------|
| `getClientConfig()` | 获取本机配置（userKey、环境模式等） |
| `getUserKey()` | 获取当前登录 userKey |
| `getAppId()` | 获取当前窗口的 appId |
| `getAppWorkdir(appId?)` | 获取应用工作目录 |
| `setAppWorkdir(input)` | 设置应用工作目录 |
| `getAppDetail(input)` | 根据 appId 获取应用详情 |
| `openInBrowser(input)` | 系统默认浏览器打开 URL |
| `openExternalApp(input)` | 系统默认程序打开文件/目录 |
| `openExternalAppByName(input)` | 按应用名启动应用（macOS/Windows） |
| `showMain()` | 显示主窗口 |
| `quit()` | 退出应用 |
| `listServices()` | 查看所有注册的服务与方法 |
| `getDevMode()` / `setDevMode(enabled)` | 开发者模式开关 |

> 以上方法通过 `app` 或 `eventCenter` 服务均可在 MQTT 模式下调用（`args[0]` 带 `appId` 即可）。

> 每个服务也可通过 `eventCenter.invoke(serviceName, method, args)` 调用。完整入参、返回值、类型定义见 [docs/api.md](docs/api.md)。

## 📖 快速示例

```ts
// 本地 MQTT 服务
const status = await window.eventCenter.getMqttBrokerStatus()
await window.eventCenter.updateMqttBrokerConfig({ port: 1885, username: 'admin', password: 'secret' })

// Agent 调用
const result = await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '帮我分析这段代码',
  allowTools: true,
  plugins: [{ type: 'local', path: '/path/to/plugin' }]
})

// Vision
const img = await window.eventCenter.readImageAsBase64({ path: '/design.png', maxWidth: 2048 })
await window.eventCenter.runAgentWithModel({
  agentName: 'claude',
  prompt: '根据设计图生成代码',
  images: [{ base64: img.base64, detail: 'high' }]
})

// HTTP 代理（绕过 CORS）
const res = await window.eventCenter.proxyFetch({
  url: 'https://api.example.com/data',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
})

// 多账户切换
const { profiles } = await window.eventCenter.listProfiles()
await window.eventCenter.switchProfile({ userKey: profiles[0].userKey })
```

> 📚 完整 API 参考见 [docs/api.md](docs/api.md)

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
