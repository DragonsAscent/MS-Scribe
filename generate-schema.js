const fs = require("fs")
const path = require("path")

const WIKI_DIR = "./MagicSpells.wiki"
const OUTPUT = "./schema.json"



function stripFormatting(text) {

    if (!text) return ""

    text = text.replace(/`/g, "")
    text = text.replace(/\*\*/g, "")
    text = text.replace(/~~/g, "")

    text = text.replace(/<[^>]*>/g, "")

    // remove version notes
    text = text.replace(/since\s+[\d.\s]*beta\s*\d+/gi, "")
    text = text.replace(/beta\s*\d+/gi, "")

    // convert markdown links
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

    return text.trim()
}



function normalizeType(type) {

    if (!type) return "any"

    type = type.toLowerCase()

    if (type.includes("int")) return "number"
    if (type.includes("float")) return "number"
    if (type.includes("double")) return "number"

    if (type.includes("boolean")) return "boolean"
    if (type.includes("bool")) return "boolean"

    if (type.includes("string")) return "string"
    if (type.includes("text")) return "string"

    if (type.includes("list")) return "array"

    return "any"
}



function splitOptions(name) {

    name = stripFormatting(name)

    name = name.split("\n")[0]

    let parts = name.split(/\s*,\s*|\s+or\s+|\s*&\s*/)

    return parts.map(p => p.trim()).filter(Boolean)
}



function parseTable(md) {

    const lines = md.split("\n")

    let start = -1

    for (let i = 0; i < lines.length; i++) {

        if (lines[i].toLowerCase().includes("| option")) {
            start = i + 2
            break
        }
    }

    if (start === -1) return []

    const rows = []

    for (let i = start; i < lines.length; i++) {

        const line = lines[i]

        if (!line.includes("|")) break

        rows.push(line.split("|").map(x => x.trim()))
    }

    return rows
}



function parseSpell(file) {

    const md = fs.readFileSync(file, "utf8")

    const rows = parseTable(md)

    if (!rows.length) return null

    const options = {}

    for (const cols of rows) {

        const name = cols[1]
        const desc = stripFormatting(cols[2])
        const type = normalizeType(cols[3])
        const def = stripFormatting(cols[4])

        const keys = splitOptions(name)

        for (const key of keys) {

            options[key] = {
                type,
                default: def || null,
                description: desc
            }
        }
    }

    return options
}



function generate() {

    const files = fs.readdirSync(WIKI_DIR)

    const schema = {}

    for (const f of files) {

        if (!f.endsWith(".md")) continue
        if (!f.includes("Spell")) continue

        const spell = f.replace(".md","")

        const options = parseSpell(path.join(WIKI_DIR,f))

        if (!options) continue

        schema[spell] = { options }
    }

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(schema,null,2)
    )

    console.log("Schema generated.")
}



generate()