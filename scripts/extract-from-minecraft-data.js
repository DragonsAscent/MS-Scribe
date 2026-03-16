const fs = require('fs')
const path = require('path')

// Usage: node scripts/extract-from-minecraft-data.js [version]
// Default version: 1.20.5
const version = process.argv[2] || '1.20.5'
const base = path.resolve(__dirname, '../tools/minecraft-data/data/pc', version)
if (!fs.existsSync(base)) {
  console.error('Version folder not found:', base)
  process.exit(2)
}

const outDir = path.resolve(__dirname, '../registries')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

function writeList(key, ids) {
  const file = path.join(outDir, `${key}.json`)
  fs.writeFileSync(file, JSON.stringify(Array.from(new Set(ids)).sort(), null, 2))
  console.log(`Wrote ${file} (${ids.length})`)
}

// candidate files to extract
const candidates = {
  particle: 'particles.json',
  biome: 'biomes.json',
  item: 'items.json',
  entity: 'entities.json',
  effect: 'effects.json',
  instrument: 'instruments.json'
}

for (const [key, file] of Object.entries(candidates)) {
  const p = path.join(base, file)
  if (!fs.existsSync(p)) continue
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    // many of these are arrays of {id,name}
    let ids = []
    if (Array.isArray(j)) {
      ids = j.map(e => e.name || e.id || '').filter(Boolean)
    } else if (typeof j === 'object') {
      ids = Object.keys(j)
    }
    if (ids.length) writeList(key, ids)
  } catch (e) {
    console.warn('failed to parse', p, e && e.message)
  }
}

console.log('Extraction from minecraft-data complete.')
