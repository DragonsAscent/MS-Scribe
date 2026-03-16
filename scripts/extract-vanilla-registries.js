const fs = require('fs')
const path = require('path')

// Usage: node scripts/extract-vanilla-registries.js [vanilla-mcdoc-path]
// Default assumes the repo is checked out under tools/vanilla-mcdoc
const repo = process.argv[2] || path.resolve(__dirname, '../tools/vanilla-mcdoc')
const candidates = [
  path.join(repo, 'data', 'vanilla', 'registries'),
  path.join(repo, 'data', 'registries'),
  path.join(repo, 'registries')
]

const outDir = path.resolve(__dirname, '../registries')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

function collectIdsFromJson(obj) {
  if (!obj) return []
  // Array of primitives or objects
  if (Array.isArray(obj)) {
    return obj.map(e => {
      if (!e) return null
      if (typeof e === 'string') return e
      if (typeof e === 'object') return e.id || e.name || e[0] || null
      return null
    }).filter(Boolean)
  }

  // Registry object shape: { entries: [...]} or { values: [...] }
  if (Array.isArray(obj.entries)) {
    return obj.entries.map(e => (Array.isArray(e) ? e[0] : (e.id || e.name))).filter(Boolean)
  }
  if (Array.isArray(obj.values)) {
    return obj.values.map(e => (e.id || e.name || (Array.isArray(e) ? e[0] : null))).filter(Boolean)
  }

  // If the JSON is an object mapping id->value, return keys
  if (typeof obj === 'object') {
    return Object.keys(obj)
  }

  return []
}

let found = false
for (const cand of candidates) {
  if (!fs.existsSync(cand)) continue
  found = true
  const files = fs.readdirSync(cand).filter(f => f.endsWith('.json'))
  for (const f of files) {
    try {
      const p = path.join(cand, f)
      const raw = fs.readFileSync(p, 'utf8')
      const j = JSON.parse(raw)

      // Name: strip namespace if present (minecraft:particle.json -> particle)
      const base = path.basename(f, '.json')
      const key = base.includes(':') ? base.split(':')[1] : base

      const ids = Array.from(new Set(collectIdsFromJson(j))).sort()
      if (!ids.length) continue

      fs.writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify(ids, null, 2))
      console.log(`Wrote registries/${key}.json (${ids.length} entries)`)
    } catch (e) {
      console.warn('failed to parse', f, e && e.message)
    }
  }
}

if (!found) {
  console.error('No registry folder found in candidates. Clone vanilla-mcdoc into tools/vanilla-mcdoc or pass its path as an arg.')
  process.exit(2)
}

console.log('Extraction complete.')
