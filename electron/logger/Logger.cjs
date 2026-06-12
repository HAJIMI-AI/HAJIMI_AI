// ── Logger — core class: level filtering, formatting, output dispatch ──────

const path = require('path')
const { LEVEL_WEIGHT, resolveConfig } = require('./config.cjs')
const DefaultFormat = require('./formats/DefaultFormat.cjs')
const JsonFormat = require('./formats/JsonFormat.cjs')
const { FileWriter } = require('./writers/FileWriter.cjs')
const { ConsoleWriter } = require('./writers/ConsoleWriter.cjs')

class Logger {
  /**
   * @param {object} opts
   * @param {string} opts.logDir - absolute path to log directory
   * @param {object} [opts.config] - log level/format/retention config (from appSettings.json)
   * @param {string} [opts.category] - default category for this instance
   */
  constructor(opts) {
    this._category = opts.category || null
    this._config = resolveConfig(opts.config || {})

    // Format pipeline
    this._formatFn = this._config.format === 'json'
      ? JsonFormat.format
      : DefaultFormat.format

    // Output writers
    this._consoleWriter = new ConsoleWriter({ enabled: this._config.consoleEnabled })
    this._fileWriter = new FileWriter({
      logDir: opts.logDir,
      keepDays: this._config.keepDays,
      maxFileSizeBytes: this._config.maxFileSizeMB * 1024 * 1024,
      maxTotalSizeBytes: this._config.maxTotalSizeMB * 1024 * 1024,
      formatFn: this._formatFn
    })

    this._fileWriter.start()

    // Storage for queryable entries (in-memory ring buffer for recent logs)
    this._ringMax = 5000
    this._ring = []
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a child logger that inherits config but uses a different category.
   * @param {string} category
   * @returns {ChildLogger}
   */
  child(category) {
    return new ChildLogger(this, category)
  }

  debug(message, meta) {
    this._log('debug', this._category, message, meta)
  }

  info(message, meta) {
    this._log('info', this._category, message, meta)
  }

  warn(message, meta) {
    this._log('warn', this._category, message, meta)
  }

  error(message, meta) {
    this._log('error', this._category, message, meta)
  }

  /**
   * Update logger config at runtime.
   */
  updateConfig(userConfig) {
    this._config = resolveConfig(userConfig)
    this._formatFn = this._config.format === 'json'
      ? JsonFormat.format
      : DefaultFormat.format
    this._consoleWriter.setEnabled(this._config.consoleEnabled)
  }

  /**
   * Query recent log entries (for UI viewer).
   */
  query({ level, category, startTime, endTime, limit = 200, offset = 0 } = {}) {
    let entries = [...this._ring]

    if (level) {
      const minWeight = LEVEL_WEIGHT[level] || 0
      entries = entries.filter(e => (LEVEL_WEIGHT[e.level] || 0) >= minWeight)
    }
    if (category) {
      entries = entries.filter(e => e.category === category)
    }
    if (startTime != null) {
      entries = entries.filter(e => e.timestamp >= startTime)
    }
    if (endTime != null) {
      entries = entries.filter(e => e.timestamp <= endTime)
    }

    const total = entries.length
    const paged = entries.slice(offset, offset + limit)

    return { total, entries: paged }
  }

  /**
   * Flush buffered writes and stop the file writer — call before app exit.
   */
  dispose() {
    if (this._fileWriter) {
      this._fileWriter.stop()
      this._fileWriter.flushSync()
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _log(level, category, message, meta) {
    // Level check
    const entryWeight = LEVEL_WEIGHT[level] || 0
    const minWeight = LEVEL_WEIGHT[this._config.level] || 0
    if (entryWeight < minWeight) return

    // Normalize: if message is an Error, extract its message
    let msg = message
    if (message instanceof Error) {
      msg = message.message
      meta = meta ? { ...meta, stack: message.stack } : { stack: message.stack }
    } else if (typeof message !== 'string') {
      msg = String(message)
    }

    const entry = {
      timestamp: Date.now(),
      level,
      category: category || null,
      message: msg,
      meta: meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : (meta != null ? { value: meta } : null)
    }

    // Format
    const line = this._formatFn(entry)

    // Console output
    this._consoleWriter.write(entry, line)

    // File output
    this._fileWriter.write(line)

    // Ring buffer
    this._ring.push(entry)
    if (this._ring.length > this._ringMax) {
      this._ring.splice(0, this._ring.length - this._ringMax)
    }
  }
}

// ── ChildLogger — thin proxy with pre-bound category ───────────────────────

class ChildLogger {
  /**
   * @param {Logger} parent
   * @param {string} category
   */
  constructor(parent, category) {
    this._parent = parent
    this._category = category
  }

  child(category) {
    return new ChildLogger(this._parent, category)
  }

  debug(message, meta) {
    this._parent._log('debug', this._category, message, meta)
  }

  info(message, meta) {
    this._parent._log('info', this._category, message, meta)
  }

  warn(message, meta) {
    this._parent._log('warn', this._category, message, meta)
  }

  error(message, meta) {
    this._parent._log('error', this._category, message, meta)
  }
}

module.exports = { Logger, ChildLogger }
