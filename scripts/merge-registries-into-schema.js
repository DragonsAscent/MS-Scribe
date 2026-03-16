const fs = require('fs')
const path = require('path')

const SCHEMA = path.resolve(__dirname, '../schema.json')
const REG_DIR = path.resolve(__dirname, '../registries')

if (!fs.existsSync(SCHEMA)) {
  console.error('schema.json not found at', SCHEMA)
  process.exit(2)
}
if (!fs.existsSync(REG_DIR)) {
  console.error('registries dir not found at', REG_DIR)
  process.exit(2)
}

const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'))
const regFiles = fs.readdirSync(REG_DIR).filter(f => f.endsWith('.json'))
const registries = {}
for (const rf of regFiles) {
  try {
    const k = path.basename(rf, '.json')
    registries[k] = JSON.parse(fs.readFileSync(path.join(REG_DIR, rf), 'utf8'))
  } catch (e) {
    // skip
  }
}

if (!Object.keys(registries).length) {
  console.error('no registries loaded')
  process.exit(2)
}

// attach registries
schema.registries = registrys = registries

// heuristically attach enums to options
for (const [spellName, spellData] of Object.entries(schema)) {
  if (!spellData || !spellData.options) continue
  for (const optName of Object.keys(spellData.options)) {
    const lower = optName.toLowerCase()
    for (const [regKey, list] of Object.entries(registries)) {
      if (lower === regKey || lower.includes(regKey) || regKey.includes(lower)) {
        const opt = spellData.options[optName]
        if (opt && (!opt.enum || !opt.enum.length)) {
          opt.enum = list.slice()
        }
      }
    }
  }
}

// backup original
fs.copyFileSync(SCHEMA, SCHEMA + '.bak')
fs.writeFileSync(SCHEMA, JSON.stringify(schema, null, 2))
console.log('Merged registries into schema.json (backup at schema.json.bak)')
