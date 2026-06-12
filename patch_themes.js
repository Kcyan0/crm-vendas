/**
 * patch_themes.js
 * Substitui todas as ocorrências hardcodadas de #BEFF00 por var(--accent)
 * e classes CSS correspondentes em todos os arquivos TSX/TS do projeto.
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
    'src/app/page.tsx',
    'src/app/dashboard/page.tsx',
    'src/app/dashboard/DashboardGrid.tsx',
    'src/app/dashboard/SortableItem.tsx',
    'src/app/performance/page.tsx',
    'src/app/overview/page.tsx',
    'src/app/login/page.tsx',
    'src/app/settings/page.tsx',
    'src/app/calendar/page.tsx',
    'src/app/team/page.tsx',
    'src/app/projects/page.tsx',
];

// Ordered replacements — most specific first
const REPLACEMENTS = [
    // ── Inline style props (JS strings) ─────────────────────────────────────
    // rgba with spaces
    [/rgba\(\s*190\s*,\s*255\s*,\s*0\s*,/g, 'rgba(var(--accent-rgb),'],
    // Hover color #A8E800 (only as accent-hover)
    [/'#A8E800'/g, "'var(--accent-hover)'"],
    [/"#A8E800"/g, '"var(--accent-hover)"'],
    // #CEFF33 (used as btn hover in old globals)
    [/'#CEFF33'/g, "'var(--accent-hover)'"],
    [/"#CEFF33"/g, '"var(--accent-hover)"'],
    // Main accent as JS string
    [/'#BEFF00'/g, "'var(--accent)'"],
    [/"#BEFF00"/g, '"var(--accent)"'],

    // ── SVG / HTML attributes (unquoted or template literal) ─────────────────
    [/fill="#BEFF00"/g, 'fill="var(--accent)"'],
    [/stroke="#BEFF00"/g, 'stroke="var(--accent)"'],

    // ── Tailwind arbitrary-value classes ─────────────────────────────────────
    // Must be inside className strings — replace the bracket notation
    // Order: longer/more-specific modifiers first
    [/focus:ring-\[#BEFF00\]/g, 'focus:ring-accent'],
    [/focus:border-\[#BEFF00\]/g, 'focus:border-accent'],
    [/focus:outline-none focus:border-\[#BEFF00\]/g, 'focus:outline-none focus:border-accent'],
    [/hover:bg-\[#BEFF00\]/g, 'hover:bg-accent'],
    [/hover:text-\[#BEFF00\]/g, 'hover:text-accent'],
    [/hover:border-\[#BEFF00\]/g, 'hover:border-accent'],
    // Opacity modifier e.g. bg-[#BEFF00]/5
    [/bg-\[#BEFF00\]\/5/g, 'bg-accent-5'],
    [/bg-\[#BEFF00\]\/10/g, 'bg-accent-12'],
    [/bg-\[#BEFF00\]\/12/g, 'bg-accent-12'],
    [/border-\[#BEFF00\]\/30/g, 'border-accent-30'],
    // Plain Tailwind utilities
    [/text-\[#BEFF00\]/g, 'text-accent'],
    [/bg-\[#BEFF00\]/g, 'bg-accent'],
    [/border-\[#BEFF00\]/g, 'border-accent'],
    [/ring-\[#BEFF00\]/g, 'ring-accent'],
    [/fill-\[#BEFF00\]/g, 'fill-accent'],
    [/stroke-\[#BEFF00\]/g, 'stroke-accent'],
];

let totalChanges = 0;

for (const relPath of TARGET_FILES) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`⚠  Skipping (not found): ${relPath}`);
        continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;

    for (const [pattern, replacement] of REPLACEMENTS) {
        content = content.replace(pattern, replacement);
    }

    if (content !== original) {
        fs.writeFileSync(fullPath, content);
        // Count changes
        const count = (original.match(/#BEFF00/g) || []).length + (original.match(/#A8E800/g) || []).length;
        console.log(`✅ ${relPath} — ~${count} substituições`);
        totalChanges++;
    } else {
        console.log(`─  ${relPath} — sem alterações`);
    }
}

console.log(`\n🎨 Concluído: ${totalChanges} arquivo(s) modificado(s).`);
console.log('   Verifique se build passa: npm run build');
