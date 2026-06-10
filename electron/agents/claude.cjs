const { app } = require('electron')
const path = require('path')
const fs = require('fs')

/** Resolve the real filesystem path to the native Claude CLI binary.
 *  Packaged Electron apps use asar — the SDK resolves require paths inside
 *  the asar archive, but spawn/execFile cannot execute binaries from there.
 *  The actual binary is unpacked at app.asar.unpacked by electron-builder. */
function resolveClaudeBinary() {
  if (!app.isPackaged) return undefined // let SDK resolve it in dev mode
  const appPath = app.getAppPath()               // e.g. /path/to/app.asar
  const baseDir = path.dirname(appPath)           // e.g. /path/to
  const platformDir = `claude-agent-sdk-${process.platform}-${process.arch}`
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const resolved = path.join(baseDir, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', platformDir, binaryName)
  // Validate the binary actually exists on disk — failing early gives a clear
  // error instead of a cryptic spawn failure deep inside the SDK.
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Claude native binary not found at: ${resolved}\n` +
      `This can happen when cross-compiling from another platform. ` +
      `Run "npm run build:win:prepare" before "npm run build:win" to include the Windows native binary.`
    )
  }
  return resolved
}

async function run(input) {
  const prompt = typeof input?.prompt === 'string' ? input.prompt : ''
  if (!prompt) throw new Error('prompt is required')

  const resume = typeof input?.sessionId === 'string' && input.sessionId.trim() ? input.sessionId.trim() : undefined
  const model = typeof input?.model === 'string' && input.model.trim() ? input.model.trim() : undefined
  const api_token =
    typeof input?.api_token === 'string' && input.api_token.trim() ? input.api_token.trim() : undefined
  const api_url =
    typeof input?.api_url === 'string' && input.api_url.trim() ? input.api_url.trim() : undefined
  const cwd = typeof input?.cwd === 'string' && input.cwd.trim() ? input.cwd.trim() : undefined
  const allowTools = input?.allowTools === true
  const collectMessages = input?.collectMessages === true
  const permissionMode =
    typeof input?.permissionMode === 'string' && input.permissionMode ? input.permissionMode : undefined
  const images = Array.isArray(input?.images) ? input.images : []
  const plugins = Array.isArray(input?.plugins) ? input.plugins : undefined
  const sdkOptions = input?.sdkOptions && typeof input.sdkOptions === 'object' ? input.sdkOptions : {}

  const sdk = await import('@anthropic-ai/claude-agent-sdk')
  const { query } = sdk

  const env = {
    ...process.env,
    CLAUDE_AGENT_SDK_CLIENT_APP: process.env.CLAUDE_AGENT_SDK_CLIENT_APP || 'common_electron_claude_base'
  }
  if (api_token) env.ANTHROPIC_API_KEY = api_token
  if (api_url) {
    env.ANTHROPIC_BASE_URL = api_url
    env.ANTHROPIC_API_URL = api_url
  }

  const options = {
    cwd,
    env,
    model,
    resume,
    ...(plugins ? { plugins } : {}),
    pathToClaudeCodeExecutable: resolveClaudeBinary()
  }

  if (!allowTools) {
    options.tools = []
    options.permissionMode = 'dontAsk'
  } else if (permissionMode) {
    // allowTools=true + explicit permission mode (e.g. 'dontAsk' to auto-approve)
    options.permissionMode = permissionMode
  }

  // Merge extra SDK options (allow override of anything above)
  Object.assign(options, sdkOptions)

  // When images are present, use AsyncIterable<SDKUserMessage> with content blocks
  // so the Anthropic API receives vision-compatible message content.
  let qInput
  if (images.length > 0) {
    const contentBlocks = []
    for (const img of images) {
      const raw = typeof img?.base64 === 'string' ? img.base64 : ''
      if (!raw) continue
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        const detail = img?.detail === 'low' || img?.detail === 'high' || img?.detail === 'auto' ? img.detail : 'auto'
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2]
          },
          detail
        })
      }
    }
    contentBlocks.push({ type: 'text', text: prompt })

    qInput = {
      prompt: (async function* () {
        yield {
          type: 'user',
          message: { role: 'user', content: contentBlocks },
          parent_tool_use_id: null
        }
      })(),
      options
    }
  } else {
    qInput = { prompt, options }
  }

  const q = query(qInput)

  let resultMessage = null
  const messages = collectMessages ? [] : null

  for await (const message of q) {
    if (messages) messages.push(message)
    if (message?.type === 'result') resultMessage = message
  }

  if (!resultMessage) {
    throw new Error('Claude Agent SDK did not return a result message')
  }

  return {
    sessionId: resultMessage.session_id,
    messageId: resultMessage.uuid,
    ok: resultMessage.is_error !== true,
    result: resultMessage.result,
    stopReason: resultMessage.stop_reason,
    usage: resultMessage.usage,
    totalCostUsd: resultMessage.total_cost_usd,
    messages
  }
}

module.exports = {
  name: 'claude',
  description: 'Claude Agent SDK (Claude Code) integration',
  run
}
