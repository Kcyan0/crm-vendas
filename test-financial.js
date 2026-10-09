function caixaInPeriod(row, startDate, endDate) {
    const parcelas = row.numero_parcelas || 1;
    const totalLiq = row.valor_liquido_caixa != null
        ? parseFloat(row.valor_liquido_caixa)
        : (parseFloat(row.valor_bruto) || 0);
    const valorParcela = totalLiq / parcelas;

    const rawDate = (row.data_recebimento || (row.data_venda || '').substring(0, 10));
    if (!rawDate) return 0;

    const dateParts = rawDate.split('-');
    if (dateParts.length < 3) return 0;

    const [y, m, d] = dateParts.map(Number);

    let total = 0;
    for (let i = 0; i < parcelas; i++) {
        let instY = y;
        let instM = m - 1 + i;
        instY += Math.floor(instM / 12);
        instM = instM % 12;

        const instDateStr = `${instY}-${String(instM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (instDateStr >= startDate && instDateStr <= endDate) {
            total += valorParcela;
        }
    }
    return total;
}

const thalisSales = [
  {
    id_venda: 3225,
    valor_liquido_caixa: 4000,
    numero_parcelas: 1,
    data_venda: '2026-10-01T12:00:00+00:00',
    data_recebimento: '2026-10-01',
  },
  {
    id_venda: 3226,
    valor_liquido_caixa: 2000,
    numero_parcelas: 1,
    data_venda: '2026-10-05T12:00:00+00:00',
    data_recebimento: '2026-10-05',
  }
];

let sum = 0;
for (const v of thalisSales) {
    console.log(v.id_venda, "->", caixaInPeriod(v, '2026-10-01', '2026-10-31'));
    sum += caixaInPeriod(v, '2026-10-01', '2026-10-31');
}
console.log("Total:", sum);
