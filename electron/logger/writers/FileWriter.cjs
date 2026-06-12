// ── File writer — buffered async writes with daily rotation and cleanup ────

const fs = require('fs')
const path = require('path')

class FileWriter {
  /**
   * @param {object} opts
   * @param {string} opts.logDir - absolute path to log directory
   * @param {number} opts.keepDays - days to retain
   * @param {number} opts.maxFileSizeBytes - max bytes per file before rotation
   * @param {number} opts.maxTotalSizeBytes - total max bytes across all log files
   * @param {function} opts.formatFn - (entry) => string
   * @param {number} [opts.flushIntervalMs=1000] - flush buffer every N ms
   * @param {number} [opts.flushThreshold=100] - flush buffer when N entries accumulate
   */
  constructor(opts) {
    this._logDir = opts.logDir
    this._keepDays = opts.keepDays
    this._maxFileSizeBytes = opts.maxFileSizeBytes
    this._maxTotalSizeBytes = opts.maxTotalSizeBytes
    this._formatFn = opts.formatFn
    this._flushIntervalMs = opts.flushIntervalMs || 1000
    this._flushThreshold = opts.flushThreshold || 100

    this._buffer = []
    this._currentPath = null
    this._currentDate = null  // 'YYYY-MM-DD'
    this._suffix = 0          // rotation suffix when same-day file exceeds max size
    this._timer = null
    this._started = false
  }

  start() {
    if (this._started) return
    this._started = true

    fs.mkdirSync(this._logDir, { recursive: true })

    this._timer = setInterval(() => this._flush(), this._flushIntervalMs)
    this._timer.unref() // don't keep process alive for the timer

    // Clean up old files on start
    this._cleanup()
  }

  stop() {
    this._started = false
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  /**
   * Enqueue a formatted line for writing.
   * @param {string} line
   */
  write(line) {
    if (!this._started) return
    this._buffer.push(line)
    if (this._buffer.length >= this._flushThreshold) {
      this._flush()
    }
  }

  /**
   * Flush buffer to disk synchronously — for clean exit.
   */
  flushSync() {
    this._flush()
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _flush() {
    if (this._buffer.length === 0) return
    const lines = this._buffer.splice(0)
    const content = lines.join('\n') + '\n'

    try {
      const filePath = this._resolveFilePath()
      fs.appendFileSync(filePath, content, 'utf8')
    } catch {
      // Can't do much — don't crash the app because of log write failure
    }
  }

  /**
   * Resolve the current log file path, rotating if needed.
   */
  _resolveFilePath() {
    const today = this._dateKey()
    if (this._currentDate !== today) {
      this._currentDate = today
      this._suffix = 0
      this._currentPath = this._buildPath(today, 0)
      return this._currentPath
    }

    // Check if current file exceeded max size
    if (this._currentPath) {
      try {
        const stat = fs.statSync(this._currentPath)
        if (stat.size >= this._maxFileSizeBytes) {
          this._suffix++
          this._currentPath = this._buildPath(this._currentDate, this._suffix)
        }
      } catch { /* file may not exist yet */ }
    }

    if (!this._currentPath) {
      this._currentPath = this._buildPath(this._currentDate, this._suffix)
    }

    return this._currentPath
  }

  _buildPath(dateKey, suffix) {
    if (suffix > 0) {
      return path.join(this._logDir, `app-${dateKey}.${suffix}.log`)
    }
    return path.join(this._logDir, `app-${dateKey}.log`)
  }

  _dateKey() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  /**
   * Remove log files older than keepDays and enforce total size limit.
   */
  _cleanup() {
    try {
      const entries = fs.readdirSync(this._logDir)
        .filter(name => /^app-\d{4}-\d{2}-\d{2}(\.\d+)?\.log$/.test(name))
        .map(name => {
          const fullPath = path.join(this._logDir, name)
          try {
            return { name, path: fullPath, mtime: fs.statSync(fullPath).mtime, size: fs.statSync(fullPath).size }
          } catch {
            return null
          }
        })
        .filter(Boolean)

      const cutoffDate = new Date(Date.now() - this._keepDays * 24 * 3600 * 1000)

      // Remove expired files
      for (const e of entries) {
        if (e.mtime < cutoffDate) {
          try { fs.unlinkSync(e.path) } catch {}
        }
      }

      // Enforce total size limit — remove oldest first
      const remaining = entries
        .filter(e => e.mtime >= cutoffDate)
        .sort((a, b) => a.mtime - b.mtime) // oldest first

      let totalSize = remaining.reduce((sum, e) => sum + e.size, 0)
      for (const e of remaining) {
        if (totalSize <= this._maxTotalSizeBytes) break
        try { fs.unlinkSync(e.path) } catch {}
        totalSize -= e.size
      }
    } catch { /* non-critical */ }
  }
}

module.exports = { FileWriter }
