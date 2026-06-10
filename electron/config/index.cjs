const path = require('path')
const fs = require('fs')

function readJsonConfig(filename) {
  const configPath = path.join(__dirname, filename)
  const raw = fs.readFileSync(configPath, 'utf8')
  return JSON.parse(raw)
}

function loadUrlsConfig() {
  let fileConfig = {}
  try {
    fileConfig = readJsonConfig('urls.json')
  } catch {
    // urls.json is committed — this codepath is a safety net
  }

  return {
    /** CDN base URL for fingerprint-based app downloads. Overridable via CDN_BASE env var. */
    get cdnBase() {
      const envVal = typeof process.env.CDN_BASE === 'string' ? process.env.CDN_BASE.trim() : ''
      return envVal || fileConfig.cdnBase || ''
    },

    /** uni-id-co service URL. Overridable via UNI_ID_CO_URL env var. */
    get uniIdCoUrl() {
      const envVal = typeof process.env.UNI_ID_CO_URL === 'string' ? process.env.UNI_ID_CO_URL.trim() : ''
      return envVal || fileConfig.uniIdCoUrl || ''
    }
  }
}

/**
 * Load the list of seeded (built-in) apps.
 *
 * Returns an array of seed-app config objects:
 *   { appId, name, description, version, mode, url, iconPath?, pinned? }
 *
 * Priority: SEEDED_APPS env var (JSON array) > seeded-apps.json file.
 */
function loadSeededAppsConfig() {
  const envVal = typeof process.env.SEEDED_APPS === 'string' ? process.env.SEEDED_APPS.trim() : ''
  if (envVal) {
    try {
      const parsed = JSON.parse(envVal)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }

  try {
    return readJsonConfig('seeded-apps.json')
  } catch {
    return []
  }
}

module.exports = { loadUrlsConfig, loadSeededAppsConfig }
