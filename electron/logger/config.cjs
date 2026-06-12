// ── Logger config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  level: 'info',           // debug | info | warn | error
  format: 'text',          // text | json
  consoleEnabled: false,   // also output to console (dev can enable)
  keepDays: 7,
  maxFileSizeMB: 10,
  maxTotalSizeMB: 100
}

const LEVEL_WEIGHT = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

/**
 * Merge user config with defaults.
 */
function resolveConfig(userConfig) {
  const cfg = { ...DEFAULT_CONFIG }
  if (userConfig && typeof userConfig === 'object') {
    if (typeof userConfig.level === 'string' && LEVEL_WEIGHT[userConfig.level]) {
      cfg.level = userConfig.level
    }
    if (userConfig.format === 'text' || userConfig.format === 'json') {
      cfg.format = userConfig.format
    }
    if (typeof userConfig.consoleEnabled === 'boolean') {
      cfg.consoleEnabled = userConfig.consoleEnabled
    }
    if (typeof userConfig.keepDays === 'number' && userConfig.keepDays >= 1) {
      cfg.keepDays = userConfig.keepDays
    }
    if (typeof userConfig.maxFileSizeMB === 'number' && userConfig.maxFileSizeMB >= 1) {
      cfg.maxFileSizeMB = userConfig.maxFileSizeMB
    }
    if (typeof userConfig.maxTotalSizeMB === 'number' && userConfig.maxTotalSizeMB >= 10) {
      cfg.maxTotalSizeMB = userConfig.maxTotalSizeMB
    }
  }
  return cfg
}

module.exports = { DEFAULT_CONFIG, LEVEL_WEIGHT, resolveConfig }
