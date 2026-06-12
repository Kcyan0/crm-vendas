const fs = require('fs');

const path = 'src/app/api/metrics/route.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove baseGateway and caixaInPeriod implementations
const regex = /\/\/ Strip "\(\w+\)".*?\}[\s\n]*export async function GET/s;
content = content.replace(regex, `import { baseGateway, caixaInPeriod } from '@/lib/financial';\n\nexport async function GET`);

// 2. Change vendasCaixa Query limit
// Find:
// const { data: vendasCaixa } = await supabase
//     .from('vendas')
//     // ...
//     .gte('data_recebimento', startDate)

// We want to add 24 months back rule.
// We can find `.gte('data_recebimento', startDate)` and replace it. BUT wait, how is it constructed?

const startReplacement = `
        const startDateObj = new Date(\`\${startDate}T00:00:00Z\`);
        startDateObj.setFullYear(startDateObj.getFullYear() - 2); // 24 months back
        const caixaStartBoundary = startDateObj.toISOString().split('T')[0];

        // ─── 2. FETCH CASH (CAIXA LÍQUIDO) ────────────────────────────────────────`;

content = content.replace('// ─── 2. FETCH CASH (CAIXA LÍQUIDO) ────────────────────────────────────────', startReplacement);
content = content.replace(`.gte('data_recebimento', startDate)`, `.gte('data_recebimento', caixaStartBoundary)`);

fs.writeFileSync(path, content);
console.log('patched metrics');
