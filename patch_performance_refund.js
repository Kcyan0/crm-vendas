const fs = require('fs');
const path = 'src/app/api/performance/route.ts';
let content = fs.readFileSync(path, 'utf8');

// Normalize to LF for matching
const normalized = content.replace(/\r\n/g, '\n');

const oldBlock = `        // Reembolsos per user (all-time for conversation rate context)\n        let reembolsadosQuery = supabase.from('leads').select('id_sdr_responsavel, id_closer_responsavel').eq('status_atual', 'Reembolsado');\n        if (projectId) reembolsadosQuery = reembolsadosQuery.eq('id_projeto', projectId);\n        const { data: reembolsados } = await reembolsadosQuery;`;

const newBlock = `        // Reembolsos per user \u2014 filtered by data_entrada in selected period\n        let reembolsadosQuery = supabase\n            .from('leads')\n            .select('id_sdr_responsavel, id_closer_responsavel')\n            .eq('status_atual', 'Reembolsado')\n            .gte('data_entrada', \`\${startDate}T00:00:00\`)\n            .lte('data_entrada', \`\${endDate}T23:59:59\`);\n        if (projectId) reembolsadosQuery = reembolsadosQuery.eq('id_projeto', projectId);\n        const { data: reembolsados } = await reembolsadosQuery;`;

if (normalized.includes(oldBlock)) {
  const patched = normalized.replace(oldBlock, newBlock);
  // Restore CRLF
  fs.writeFileSync(path, patched.replace(/\n/g, '\r\n'));
  console.log('SUCCESS: refund filter patched in performance route');
} else {
  console.log('NOT FOUND - current lines around 177:');
  const lines = normalized.split('\n');
  for (let i = 174; i < 185; i++) {
    console.log((i+1) + ': ' + JSON.stringify(lines[i]));
  }
}
