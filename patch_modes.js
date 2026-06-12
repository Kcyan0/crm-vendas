/**
 * patch_modes.js
 * Substitui cores hardcodadas de background, texto e borda
 * por CSS custom properties mode-aware em todos os arquivos TSX.
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

const REPLACEMENTS = [
    // ── Tailwind bg classes ─────────────────────────────────────────────────
    [/bg-\[#0A0A0A\]/g,  'bg-sidebar'],
    [/bg-\[#111111\]/g,  'bg-app'],
    [/bg-\[#111\]/g,     'bg-app'],
    [/bg-\[#1A1A1A\]/g,  'bg-surface'],
    [/bg-\[#222222\]/g,  'bg-surface-2'],
    [/bg-\[#222\]/g,     'bg-surface-2'],
    [/bg-\[#2A2A2A\]/g,  'bg-surface-3'],
    [/bg-\[#333333\]/g,  'bg-surface-3'],
    [/bg-\[#333\]/g,     'bg-surface-3'],

    // ── Tailwind text classes ───────────────────────────────────────────────
    [/text-\[#888888\]/g, 'text-sec'],
    [/text-\[#888\]/g,    'text-sec'],
    [/text-\[#666666\]/g, 'text-sec'],
    [/text-\[#666\]/g,    'text-sec'],
    [/text-\[#555555\]/g, 'text-muted'],
    [/text-\[#555\]/g,    'text-muted'],

    // ── Tailwind border classes ─────────────────────────────────────────────
    [/border-\[#2A2A2A\]/g, 'border-str'],
    [/border-\[#1E1E1E\]/g, 'border-sid'],

    // ── Inline style: background (JS strings) ──────────────────────────────
    [/'#111111'/g,  "'var(--bg-app)'"],
    [/'#1A1A1A'/g,  "'var(--bg-surface)'"],
    [/'#222222'/g,  "'var(--bg-surface-2)'"],
    [/'#2A2A2A'/g,  "'var(--bg-surface-3)'"],
    [/'#1E1E1E'/g,  "'var(--sidebar-border)'"],

    // ── Inline style: text colors ───────────────────────────────────────────
    [/'#888888'/g,  "'var(--text-sec)'"],
    [/'#666666'/g,  "'var(--text-sec)'"],
    [/'#555555'/g,  "'var(--text-muted)'"],

    // ── Inline border strings ───────────────────────────────────────────────
    // e.g. border: '1px solid #2A2A2A'
    [/#2A2A2A/g,    'var(--border-str)'],
    [/#1E1E1E/g,    'var(--sidebar-border)'],
];

let totalFiles = 0;

for (const relPath of TARGET_FILES) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) { console.log(`⚠  Skipping (not found): ${relPath}`); continue; }

    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;

    for (const [pattern, replacement] of REPLACEMENTS) {
        content = content.replace(pattern, replacement);
    }

    if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log(`✅ ${relPath}`);
        totalFiles++;
    } else {
        console.log(`─  ${relPath} — sem alteracoes`);
    }
}

console.log(`\n🎨 Concluido: ${totalFiles} arquivo(s) modificado(s).`);
