const { Aedes } = require('aedes')
const net = require('net')
const http = require('http')
const { Duplex } = require('stream')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

// ── Policy ──────────────────────────────────────────────────────────────────

function getMqttBrokerPolicy() {
  try {
    const policy = require('./policy.cjs')
    const mqttBroker = policy?.mqttBroker && typeof policy.mqttBroker === 'object' ? mqttBroker : {}
    const enabled = mqttBroker.enabled === true
    const disabledReason =
      typeof mqttBroker.disabledReason === 'string' && mqttBroker.disabledReason.trim()
        ? mqttBroker.disabledReason.trim()
        : 'MQTT Broker 已禁用'
    return { enabled, disabledReason }
  } catch {
    return { enabled: true, disabledReason: '' }
  }
}

// ── Store ───────────────────────────────────────────────────────────────────

function getStorePath() {
  const baseDir = app.getPath('userData')
  const storeDir = path.join(baseDir, 'store')
  fs.mkdirSync(storeDir, { recursive: true })
  return path.join(storeDir, 'mqttBroker.json')
}

const DEFAULTS = {
  enabled: true,
  port: 1883,
  wsEnabled: true,
  wsPort: 1884,
  username: '',
  password: ''
}

function readBrokerStore() {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeBrokerStore(config) {
  const filePath = getStorePath()
  const tmpPath = `${filePath}.${Date.now()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

// ── State ───────────────────────────────────────────────────────────────────

const brokerState = {
  running: false,
  broker: null,
  tcpServer: null,
  wsServer: null,
  httpServer: null,
  config: null,
  clientCount: 0,
  clients: new Map() // id → { id, address, connectedAt }
}

// ── WebSocket stream adapter ────────────────────────────────────────────────

function createWebSocketStream(ws) {
  const duplex = new Duplex({
    write(chunk, encoding, callback) {
      if (ws.readyState === 1) {
        ws.send(chunk, callback)
      } else {
        callback(new Error('WebSocket not open'))
      }
    },
    final(callback) {
      ws.close()
      callback()
    },
    read() {}
  })

  ws.on('message', (data) => {
    duplex.push(Buffer.isBuffer(data) ? data : Buffer.from(data))
  })
  ws.on('close', () => duplex.push(null))
  ws.on('error', (err) => duplex.destroy(err))

  return duplex
}

// ── Authentication helper ───────────────────────────────────────────────────

function createAuthenticator(config) {
  const username = (config.username || '').trim()
  const password = (config.password || '').trim()

  if (!username && !password) {
    return function (client, _u, _p, callback) {
      callback(null, true)
    }
  }

  return function (client, u, p, callback) {
    // Aedes passes password as a Buffer, convert to string for comparison
    const uStr = u ? String(u) : ''
    const pStr = p ? (Buffer.isBuffer(p) ? p.toString() : String(p)) : ''
    const ok = uStr === username && pStr === password
    if (!ok) {
    }
    callback(null, ok)
  }
}

// ── Core functions ──────────────────────────────────────────────────────────

async function start() {
  const policy = getMqttBrokerPolicy()
  if (!policy.enabled) throw new Error(policy.disabledReason)

  if (brokerState.running) {
    return { ok: true, alreadyRunning: true, ...statusSnapshot() }
  }

  const config = readBrokerStore()

  if (!config.enabled) {
    throw new Error('MQTT Broker 未启用')
  }

  // Build auth function before creating broker so it's passed via opts
  const authenticate = createAuthenticator(config)

  // Create Aedes broker (async factory in v1.x)
  let broker
  try {
    broker = await Aedes.createBroker({
      id: 'hajimi-broker',
      concurrency: 100,
      authenticate
    })
  } catch (err) {
    throw new Error(`Failed to create MQTT broker: ${err.message}`)
  }


  // Track client count
  broker.on('client', (client) => {
    brokerState.clientCount += 1
    brokerState.clients.set(client.id, {
      id: client.id,
      address: client.conn?.remoteAddress || '',
      connectedAt: Date.now()
    })
  })
  broker.on('clientDisconnect', (client) => {
    brokerState.clientCount = Math.max(0, brokerState.clientCount - 1)
    brokerState.clients.delete(client.id)
  })
  broker.on('clientError', (client, err) => {
  })

  // ── TCP server ──
  const tcpServer = net.createServer(broker.handle)

  await new Promise((resolve, reject) => {
    tcpServer.once('error', (err) => {
      reject(new Error(`TCP port ${config.port} is unavailable: ${err.message}`))
    })

    tcpServer.listen(config.port, () => {
      tcpServer.removeAllListeners('error')
      tcpServer.on('error', (err) => {
      })
      resolve()
    })
  })

  // ── WebSocket server (optional) ──
  let httpServer = null
  let wsServer = null

  if (config.wsEnabled) {
    let WebSocket
    try {
      WebSocket = require('ws')
    } catch {
      config.wsEnabled = false
    }

    if (WebSocket) {
      httpServer = http.createServer()
      wsServer = new WebSocket.Server({ server: httpServer })

      wsServer.on('connection', (ws) => {
        const stream = createWebSocketStream(ws)
        broker.handle(stream)
      })

      try {
        await new Promise((resolve, reject) => {
          httpServer.once('error', (err) => {
            reject(new Error(`WebSocket port ${config.wsPort} is unavailable: ${err.message}`))
          })

          httpServer.listen(config.wsPort, () => {
            httpServer.removeAllListeners('error')
            httpServer.on('error', (err) => {
            })
            resolve()
          })
        })
      } catch (err) {
        wsServer = null
        if (httpServer) {
          try { httpServer.close() } catch {}
          httpServer = null
        }
      }
    }
  }

  // Update state
  brokerState.running = true
  brokerState.broker = broker
  brokerState.tcpServer = tcpServer
  brokerState.wsServer = wsServer
  brokerState.httpServer = httpServer
  brokerState.config = { ...config }

  const hasAuth = Boolean((config.username || '').trim())

  return {
    ok: true,
    ...statusSnapshot()
  }
}

function stop() {
  return new Promise((resolve) => {
    if (!brokerState.running) {
      resolve({ ok: true, alreadyStopped: true })
      return
    }

    const broker = brokerState.broker

    if (broker) {
      broker.close(() => {
        closeServers()
        resetState()
        resolve({ ok: true })
      })
    } else {
      closeServers()
      resetState()
      resolve({ ok: true })
    }
  })
}

function closeServers() {
  if (brokerState.tcpServer) {
    try { brokerState.tcpServer.close() } catch {}
  }
  if (brokerState.httpServer) {
    try { brokerState.httpServer.close() } catch {}
  }
}

function resetState() {
  brokerState.running = false
  brokerState.broker = null
  brokerState.tcpServer = null
  brokerState.wsServer = null
  brokerState.httpServer = null
  brokerState.config = null
  brokerState.clientCount = 0
  brokerState.clients.clear()
}

function listClients() {
  const clients = Array.from(brokerState.clients.values()).map((c) => ({
    id: c.id,
    address: c.address || 'unknown',
    connectedAt: c.connectedAt
  }))
  return { clients }
}

function getStatus() {
  return {
    running: brokerState.running,
    ...(brokerState.running ? statusSnapshot() : readBrokerStoreSnapshot())
  }
}

function statusSnapshot() {
  const config = brokerState.config || readBrokerStore()
  const hasAuth = Boolean((config.username || '').trim())
  return {
    port: config.port,
    wsPort: config.wsPort,
    wsUrl: config.wsEnabled ? `ws://localhost:${config.wsPort}` : null,
    tcpUrl: `mqtt://localhost:${config.port}`,
    wsEnabled: config.wsEnabled,
    hasAuth,
    clientCount: brokerState.clientCount
  }
}

function readBrokerStoreSnapshot() {
  const config = readBrokerStore()
  const hasAuth = Boolean((config.username || '').trim())
  return {
    port: config.port,
    wsPort: config.wsPort,
    wsUrl: config.wsEnabled ? `ws://localhost:${config.wsPort}` : null,
    tcpUrl: `mqtt://localhost:${config.port}`,
    wsEnabled: config.wsEnabled,
    hasAuth,
    clientCount: 0
  }
}

function getConfig() {
  const current = readBrokerStore()
  // Never expose the password back to the client
  return {
    enabled: current.enabled,
    port: current.port,
    wsEnabled: current.wsEnabled,
    wsPort: current.wsPort,
    username: current.username || '',
    hasAuth: Boolean((current.username || '').trim())
  }
}

async function updateConfig(input) {
  const current = readBrokerStore()

  const next = {
    enabled: input?.enabled !== undefined ? !!input.enabled : current.enabled,
    port: typeof input?.port === 'number' ? input.port : current.port,
    wsEnabled: input?.wsEnabled !== undefined ? !!input.wsEnabled : current.wsEnabled,
    wsPort: typeof input?.wsPort === 'number' ? input.wsPort : current.wsPort,
    username: typeof input?.username === 'string' ? input.username : current.username,
    password: typeof input?.password === 'string' ? input.password : current.password
  }

  // Validate
  if (next.port < 1024 || next.port > 65535) throw new Error('port must be between 1024 and 65535')
  if (next.wsPort < 1024 || next.wsPort > 65535) throw new Error('wsPort must be between 1024 and 65535')
  if (next.port === next.wsPort) throw new Error('port and wsPort must be different')

  writeBrokerStore(next)

  // Determine if we need to restart
  const wasRunning = brokerState.running
  const needsRestart =
    wasRunning &&
    (brokerState.config?.port !== next.port ||
      brokerState.config?.wsPort !== next.wsPort ||
      brokerState.config?.wsEnabled !== next.wsEnabled ||
      brokerState.config?.username !== next.username ||
      brokerState.config?.password !== next.password)

  if (!next.enabled && wasRunning) {
    await stop()
  } else if (needsRestart) {
    await stop()
    if (next.enabled) {
      await start()
    }
  } else if (next.enabled && !wasRunning) {
    await start()
  }

  return {
    config: {
      enabled: next.enabled,
      port: next.port,
      wsEnabled: next.wsEnabled,
      wsPort: next.wsPort,
      username: next.username || '',
      hasAuth: Boolean((next.username || '').trim())
    }
  }
}

// ── Registration ────────────────────────────────────────────────────────────

function register(eventCenter) {
  eventCenter.register('mqttBroker', {
    start,
    stop,
    getStatus,
    getConfig,
    updateConfig,
    listClients
  })

  // Auto-start on app launch if enabled
  const config = readBrokerStore()
  const policy = getMqttBrokerPolicy()
  if (config.enabled && policy.enabled) {
    setImmediate(() => {
      start().catch((err) => {
      })
    })
  }
}

module.exports = { register, start, stop, getStatus, getConfig, updateConfig, listClients }
