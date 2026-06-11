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
- **MQTT 远程模式** — 已开发但暂不启用，计划迁移到子应用实现，不做平台层耦合
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

## 🔌 平台服务

平台通过 `window.eventCenter` 为子应用提供以下服务，所有服务均自动注入 `appId` 实现数据隔离：

### Agent — AI 智能体调用

| 方法 | 说明 |
|------|------|
| `runAgentWithModel(input)` | 调用 Claude Agent，自动注入模型配置、工作目录。支持 Vision、插件、会话续接 |

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
| `setLocalProfile(input)` | 创建/更新本地账户 |
| `getLocalProfile(userKey?)` | 获取账户信息 |
| `listProfiles()` | 列出所有本地账户 |
| `switchProfile(input)` | 切换到已有账户（数据自动隔离） |
| `signOut()` | 退出登录 |
| `deleteProfile(input)` | 移除账户记录 |

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
```

上层应用通过 `mqtt://localhost:1883` (TCP) 或 `ws://localhost:1884` (WebSocket) 连接。

### Proxy — HTTP 代理

| 方法 | 说明 |
|------|------|
| `proxyFetch(input)` | 主进程代理 HTTP 请求，绕过浏览器 CORS / 混合内容限制 |

### System — 系统能力

| 方法 | 说明 |
|------|------|
| `getClientConfig()` | 获取本机配置（userKey、环境模式等） |
| `getAppId()` | 获取当前窗口的 appId |
| `getAppWorkdir(appId?)` | 获取应用工作目录 |
| `setAppWorkdir(input)` | 设置应用工作目录 |
| `getAppDetail(input)` | 根据 appId 获取应用详情 |
| `openInBrowser(input)` | 系统默认浏览器打开 URL |
| `openExternalApp(input)` | 系统默认程序打开文件/目录 |
| `openExternalAppByName(input)` | 按应用名启动应用 |
| `getDevMode()` / `setDevMode(enabled)` | 开发者模式开关 |
| `listServices()` | 查看所有注册的服务与方法 |

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
