async function run() {
    const res = await fetch("https://crm-vendas.vercel.app/api/metrics?startDate=2026-10-01&endDate=2026-10-31&projectId=11");
    console.log("Status:", res.status);
    const json = await res.json();
    if (res.status !== 200) {
        console.log("Error:", json);
    } else {
        const thalis = json.comissaoCloserDetalhes.find(c => c.nome === 'Thalis');
        console.log("Thalis:", thalis);
        console.log("Total Receita:", json.receita);
    }
}
run();
