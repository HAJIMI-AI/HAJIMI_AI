// ── Console writer — forwards formatted lines to console ──────────────────

const CONSOLE_METHODS = {
  debug: 'debug',
  info: 'log',
  warn: 'warn',
  error: 'error'
}

class ConsoleWriter {
  /**
   * @param {object} opts
   * @param {boolean} opts.enabled - whether console output is active
   */
  constructor(opts) {
    this._enabled = !!opts.enabled
  }

  setEnabled(val) {
    this._enabled = !!val
  }

  /**
   * Output a formatted line to console.
   * @param {import('../../formats/DefaultFormat.cjs').LogEntry} entry
   * @param {string} formattedLine
   */
  write(entry, formattedLine) {
    if (!this._enabled) return
    const method = CONSOLE_METHODS[entry.level] || 'log'
    console[method](formattedLine)
  }
}

module.exports = { ConsoleWriter }
