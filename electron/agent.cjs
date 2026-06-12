const claude = require('./agents/claude.cjs')

const registry = new Map()

// Captured during register() so standalone functions can call other services
let _eventCenter = null

function registerAgent(agent) {
  if (!agent || typeof agent !== 'object') throw new Error('agent is required')
  const name = typeof agent.name === 'string' ? agent.name.trim() : ''
  if (!name) throw new Error('agent.name is required')
  const description = typeof agent.description === 'string' ? agent.description : ''
  registry.set(name, { ...agent, name, description })
}

function listAgents() {
  return Array.from(registry.values()).map((a) => ({
    name: a.name,
    description: a.description
  }))
}

function getAgent(name) {
  const key = typeof name === 'string' ? name.trim() : ''
  return registry.get(key) || null
}

async function runAgent(input) {
  const agentName = typeof input?.agentName === 'string' ? input.agentName.trim() : ''
  if (!agentName) throw new Error('agentName is required')
  const agent = getAgent(agentName)
  if (!agent) throw new Error(`agent not found: ${agentName}`)
  if (typeof agent.run !== 'function') throw new Error(`agent ${agentName} does not support run()`)

  const { agentName: _omit, ...rest } = input || {}
  return await agent.run(rest)
}

/**
 * Unified entry point — resolves model and cwd automatically, then calls runAgent.
 * Works for both IPC (preload delegates) and MQTT (external clients).
 */
async function runAgentWithModel(input) {
  const ec = _eventCenter
  if (!ec) throw new Error('eventCenter not available')

  // ── 1. Resolve model ──────────────────────────────────────────────────
  const modelId = typeof input?.modelId === 'string' && input.modelId.trim() ? input.modelId.trim() : null
  let model = null

  if (modelId) {
    try { model = await ec.invoke('modules', 'getModel', [modelId]) } catch {}
  }

  if (!model) {
    try { model = await ec.invoke('modules', 'getSelectedModel', []) } catch {}
  }

  if (!model) {
    try {
      const models = await ec.invoke('modules', 'listModels', [])
      model = Array.isArray(models) && models.length > 0 ? models[0] : null
    } catch {}
  }

  if (!model) {
    throw new Error('未配置 AI 模型，请先在主窗口设置 → 模型管理中至少添加一个模型')
  }

  // ── 2. Resolve cwd ────────────────────────────────────────────────────
  let cwd = input.cwd || undefined

  if (!cwd) {
    const appId = input?.appId
    if (appId) {
      try {
        const wr = await ec.invoke('apps', 'getAppWorkdir', [appId])
        if (wr?.workdir) cwd = wr.workdir
      } catch {}
    }
  }

  // ── 3. Build agent input ──────────────────────────────────────────────
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
    if (model.name && !agentInput.model) agentInput.model = model.name
    if (model.api_token && !agentInput.api_token) agentInput.api_token = model.api_token
    if (model.api_url && !agentInput.api_url) agentInput.api_url = model.api_url
  }

  return await runAgent(agentInput)
}

registerAgent(claude)

function register(ec) {
  _eventCenter = ec
  ec.register('agent', {
    listAgents,
    runAgent,
    runAgentWithModel
  })
}

module.exports = {
  register,
  registerAgent,
  listAgents,
  getAgent,
  runAgent
}
