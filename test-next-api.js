const { GET } = require('./.next/server/app/api/metrics/route.js');
const { NextRequest } = require('next/server');

async function test() {
    const req = new Request('http://localhost:3000/api/metrics?startDate=2026-10-01&endDate=2026-10-31&projectId=11');
    const res = await GET(req);
    const json = await res.json();
    console.log("Status:", res.status);
    if (res.status !== 200) console.log(json);
    else {
        const thalis = json.comissaoCloserDetalhes.find(c => c.nome === 'Thalis');
        console.log("Thalis comissao:", thalis);
        console.log("Thalis receita:", json.receitaPorCloser.find(c => c.name === 'Thalis'));
    }
}
test().catch(console.error);
