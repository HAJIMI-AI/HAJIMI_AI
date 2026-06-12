// ── JSON format: one JSON object per line ─────────────────────────────────

/**
 * Format a log entry as a single-line JSON object.
 *
 * Output example:
 *   {"ts":"2026-06-12T06:32:05.123Z","level":"info","cat":"mqttBroker","msg":"TCP server listening","meta":{"port":1883}}
 */
function format(entry) {
  const obj = {
    ts: new Date(entry.timestamp).toISOString(),
    level: entry.level,
    cat: entry.category || undefined,
    msg: entry.message,
    meta: entry.meta && Object.keys(entry.meta).length > 0 ? entry.meta : undefined
  }
  // Remove undefined fields to keep output compact
  if (obj.cat === undefined) delete obj.cat
  if (obj.meta === undefined) delete obj.meta

  try {
    return JSON.stringify(obj)
  } catch {
    // Fallback if meta contains non-serializable values
    try {
      return JSON.stringify({ ts: obj.ts, level: obj.level, cat: obj.cat, msg: obj.msg })
    } catch {
      return `{"ts":"${obj.ts}","level":"error","msg":"Log serialization failed"}`
    }
  }
}

module.exports = { format }
