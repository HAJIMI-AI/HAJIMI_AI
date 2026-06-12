// ── Default text format: [timestamp] LEVEL [category] message {meta} ─────

function pad2(n) {
  return String(n).padStart(2, '0')
}

function pad3(n) {
  return String(n).padStart(3, '0')
}

/**
 * Format a log entry as a single line of human-readable text.
 *
 * Output example:
 *   [2026-06-12 14:32:05.123] INFO  [mqttBroker] TCP server listening on port 1883
 *   [2026-06-12 14:32:05.456] DEBUG [eventCenter] MQTT request | topic: alice/request | service: modules.listModels
 *   [2026-06-12 14:32:05.789] ERROR [agent] API call failed | error: timeout after 30s
 */
function format(entry) {
  const d = new Date(entry.timestamp)
  const date =
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`

  const level = entry.level.toUpperCase().padEnd(5, ' ')
  const cat = entry.category ? `[${entry.category}] ` : ''

  let line = `[${date}] ${level} ${cat}${entry.message}`

  if (entry.meta && typeof entry.meta === 'object') {
    const parts = []
    for (const [k, v] of Object.entries(entry.meta)) {
      if (v === undefined) continue
      if (v instanceof Error) {
        parts.push(`${k}: ${v.message}`)
      } else if (typeof v === 'object') {
        try { parts.push(`${k}: ${JSON.stringify(v)}`) } catch { parts.push(`${k}: [Object]`) }
      } else {
        parts.push(`${k}: ${v}`)
      }
    }
    if (parts.length > 0) {
      line += ' | ' + parts.join(' | ')
    }
  }

  return line
}

module.exports = { format }
