// ── Logger module entry point ──────────────────────────────────────────────
//
// Usage:
//   const logger = require('./logger')
//   logger.info('App started')
//
//   const brokerLog = logger.child('mqttBroker')
//   brokerLog.info('TCP server listening', { port: 1883 })
//   brokerLog.error('Start failed', new Error('port in use'))

const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { Logger } = require('./Logger.cjs')
const { resolveConfig } = require('./config.cjs')

// ── Singleton ───────────────────────────────────────────────────────────────

let _instance = null

function getLogDir() {
  return path.join(app.getPath('userData'), 'logs')
}

function getLogger() {
  if (_instance) return _instance

  let userConfig = {}
  try {
    const settingsPath = path.join(app.getPath('userData'), 'store', 'appSettings.json')
    if (fs.existsSync(settingsPath)) {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      if (parsed.logger && typeof parsed.logger === 'object') {
        userConfig = parsed.logger
      }
    }
  } catch { /* use defaults */ }

  _instance = new Logger({
    logDir: getLogDir(),
    config: userConfig
  })

  return _instance
}

// ── EventCenter registration ───────────────────────────────────────────────

function saveLoggerConfig(cfg) {
  const settingsPath = path.join(app.getPath('userData'), 'store', 'appSettings.json')
  let settings = {}
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    }
  } catch {}
  settings.logger = { ...settings.logger, ...cfg }
  const tmpPath = `${settingsPath}.${Date.now()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf8')
  fs.renameSync(tmpPath, settingsPath)
}

function register(eventCenter) {
  const log = getLogger()

  eventCenter.register('logger', {
    query: (input) => log.query(input || {}),
    getConfig: () => {
      try {
        const settingsPath = path.join(app.getPath('userData'), 'store', 'appSettings.json')
        if (fs.existsSync(settingsPath)) {
          const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
          return resolveConfig(parsed.logger || {})
        }
      } catch {}
      return resolveConfig({})
    },
    updateConfig: (input) => {
      const cfg = resolveConfig(input || {})
      saveLoggerConfig(cfg)
      log.updateConfig(cfg)
      return cfg
    },
    export: (input) => {
      const logDir = getLogDir()
      let names = []
      try {
        names = fs.readdirSync(logDir)
          .filter(n => /^app-\d{4}-\d{2}-\d{2}(\.\d+)?\.log$/.test(n))
          .sort()
      } catch { /* dir may not exist */ }

      if (input?.startTime != null || input?.endTime != null) {
        names = names.filter(n => {
          const m = n.match(/^app-(\d{4}-\d{2}-\d{2})/)
          if (!m) return true
          const fileDate = new Date(m[1]).getTime()
          if (input.startTime != null && input.endTime != null) {
            return fileDate >= input.startTime && fileDate <= input.endTime
          }
          if (input.startTime != null) return fileDate >= input.startTime
          if (input.endTime != null) return fileDate <= input.endTime
          return true
        })
      }

      return { files: names.map(n => path.join(logDir, n)) }
    },
    clear: () => {
      const logDir = getLogDir()
      try {
        const names = fs.readdirSync(logDir).filter(n => /^app-.*\.log$/.test(n))
        for (const name of names) {
          fs.unlinkSync(path.join(logDir, name))
        }
      } catch {}
      return { ok: true }
    }
  })
}

// ── Eagerly create singleton so it's ready on first require ─────────────────

const _exports = getLogger()

_exports.getLogger = getLogger
_exports.Logger = Logger
_exports.register = register

module.exports = _exports

// ── Graceful shutdown ──────────────────────────────────────────────────────

app.on('before-quit', () => {
  if (_instance) {
    _instance.dispose()
  }
})
