const claude = require('./agents/claude.cjs')

const registry = new Map()

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

registerAgent(claude)

function register(eventCenter) {
  eventCenter.register('agent', {
    listAgents,
    runAgent
  })
}

module.exports = {
  register,
  registerAgent,
  listAgents,
  getAgent,
  runAgent
}
