const fs = require("fs")
const path = require("path")

const WIKI_DIR = "./MagicSpells.wiki"
const OUTPUT = "./schema.json"
// List of all general spells (from user)
const GENERAL_SPELLS = [
    "BowSpell",
    "ExternalCommandSpell",
    "LocationSpell",
    "MenuSpell",
    "MultiSpell",
    "OffhandCooldownSpell",
    "PassiveSpell",
    "PermissionSpell",
    "PlayerMenuSpell",
    "RandomSpell",
    "TargetedMultiSpell"
];

// Path to the main wiki page for spell type mapping
const MAIN_WIKI_PAGE = path.join(WIKI_DIR, "Home.md");

// Parse the main wiki page to build a spell-to-type map
function buildSpellTypeMap() {
    if (!fs.existsSync(MAIN_WIKI_PAGE)) return {};
    const md = fs.readFileSync(MAIN_WIKI_PAGE, "utf8");
    const typeSections = [
        { header: "General Spells", type: "general" },
        { header: "Command Spells", type: "command" },
        { header: "Instant Spells", type: "instant" },
        { header: "Targeted Spells", type: "targeted" },
        { header: "Buff Spells", type: "buff" }
    ];
    const spellTypeMap = {};
    for (const section of typeSections) {
        const regex = new RegExp(`# ${section.header}:[\s\S]*?(?=\n---|\n#|$)`, "i");
        const match = md.match(regex);
        if (!match) continue;
        const block = match[0];
        // Find all spell links: [`SpellName`](SpellName)
        const spellLinks = block.match(/\[`([\w-]+)`\]\([^)]+\)/g);
        if (spellLinks) {
            for (const link of spellLinks) {
                const spellName = link.match(/\[`([\w-]+)`\]/)[1];
                spellTypeMap[spellName] = section.type;
            }
        }
    }
    return spellTypeMap;
}



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

    // convert GitHub shorthand links [[Spell Effects]] to wiki URL
    // convert GitHub shorthand links [[Spell Effects]] to Markdown links pointing at the wiki
    text = text.replace(/\[\[([^\]]+)\]\]/g, function(match, p1) {
        // Replace spaces with hyphens for wiki page
        const page = p1.replace(/\s+/g, "-");
        return `[${p1}](https://github.com/TheComputerGeek2/MagicSpells/wiki/${page})`;
    });

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
    // Map base type to base file
    const BASE_TYPE_FILES = {
        "buff": "Buff-Spell.md",
        "instant": "Instant-Spell.md",
        "command": "BindSpell.md", // Example, adjust as needed
        // Add more base types/files as needed
    };

    // Preload base options
    const baseOptionsCache = {};
    for (const [type, file] of Object.entries(BASE_TYPE_FILES)) {
        const filePath = path.join(WIKI_DIR, file);
        if (fs.existsSync(filePath)) {
            baseOptionsCache[type] = parseSpell(filePath);
        }
    }

    const files = fs.readdirSync(WIKI_DIR)

    const schema = {}

    for (const f of files) {
        if (!f.endsWith(".md")) continue
        if (!f.includes("Spell")) continue

        const spell = f.replace(".md","")
        const filePath = path.join(WIKI_DIR, f)
        const options = parseSpell(filePath)
        if (!options) continue

        let type = "unknown";
        if (GENERAL_SPELLS.includes(spell)) {
            type = "general";
        } else {
            // Extract spell-class from .md file
            const md = fs.readFileSync(filePath, "utf8");
            const spellClassMatch = md.match(/spell-class\s*:\s*"?([.a-zA-Z0-9]+)"?/);
            if (spellClassMatch) {
                const classParts = spellClassMatch[1].split(".").filter(Boolean);
                if (classParts.length > 1) {
                    type = classParts[0].toLowerCase();
                }
            }
        }

        // Merge base options if applicable
        let mergedOptions = { ...options };
        if (baseOptionsCache[type]) {
            mergedOptions = { ...baseOptionsCache[type], ...options };
        }
        schema[spell] = { type, options: mergedOptions };
    }

    // Parse condition (modifier) pages to expose modifier conditions as global options
    const conditionFiles = files.filter(fn => fn.startsWith('Condition-') && fn.endsWith('.md'));
    const globalConditions = {};
    for (const cf of conditionFiles) {
        try {
            const content = fs.readFileSync(path.join(WIKI_DIR, cf), 'utf8');
            // Look for a line like: "[Modifier](Modifiers) condition: `world`" or "condition: `name`"
            const condMatch = content.match(/condition:\s*`([^`]+)`/i) || content.match(/condition:\s*'([^']+)'/i);
            if (!condMatch) continue;
            const condName = condMatch[1].trim();
            // Extract the Description section: text after "# Description:" up to the next header (## or #) or a blank line
            let desc = '';
            const descHeader = content.match(/#\s*Description\s*:\s*\n([\s\S]*)/i);
            if (descHeader) {
                // take until next header (line starting with ## or #) or end of file
                const rest = descHeader[1];
                const stopIdx = rest.search(/\n#{1,2}\s+/);
                desc = stopIdx === -1 ? rest : rest.substring(0, stopIdx);
            } else {
                // fallback: take the first paragraph after the top
                const para = content.split(/\n\s*\n/)[0] || '';
                desc = para;
            }
            desc = stripFormatting(desc).replace(/\n+/g, ' ').trim();
            if (!desc) desc = `Modifier condition \"${condName}\" (see wiki).`;
            globalConditions[condName] = { type: 'string', description: desc };
        } catch (e) {
            // ignore parse errors for individual condition files
            continue;
        }
    }

    // Add a 'modifiers' entry that contains modifier conditions so hover/completion can find them
    if (!schema['modifiers']) schema['modifiers'] = { type: 'modifiers', options: {} };
    schema['modifiers'].options = Object.assign({}, schema['modifiers'].options || {}, globalConditions);

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(schema,null,2)
    )

    console.log("Schema generated.")
}


generate()