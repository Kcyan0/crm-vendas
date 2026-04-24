// Strip "(Entrada)" / "(Parcelas)" suffixes so we get the base gateway name
export function baseGateway(forma: string): string {
    return (forma || 'PIX').replace(/ \(Entrada\)| \(Parcelas\)/g, '').trim();
}

/**
 * Calculate how much of a venda row's caixa falls within [startDate, endDate].
 * Uses data_recebimento (plain YYYY-MM-DD) as the date of the FIRST installment.
 * Each subsequent installment lands on the same day of month, 1 month later.
 * Comparison is date-aware (YYYY-MM-DD), so day-level filters work correctly.
 */
export function caixaInPeriod(row: any, startDate: string, endDate: string): number {
    const parcelas = row.numero_parcelas || 1;
    const totalLiq = row.valor_liquido_caixa != null
        ? parseFloat(row.valor_liquido_caixa)
        : (parseFloat(row.valor_bruto) || 0);
    const valorParcela = totalLiq / parcelas;

    // data_recebimento is stored as YYYY-MM-DD (local date, no TZ)
    const rawDate = (row.data_recebimento || (row.data_venda || '').substring(0, 10));
    if (!rawDate) return 0;

    const dateParts = rawDate.split('-');
    if (dateParts.length < 3) return 0;

    const [y, m, d] = dateParts.map(Number);

    let total = 0;
    for (let i = 0; i < parcelas; i++) {
        // Compute Y-M-D of this installment: same day, i months later
        let instY = y;
        let instM = m - 1 + i; // zero-indexed
        instY += Math.floor(instM / 12);
        instM = instM % 12;

        // Build YYYY-MM-DD string for this installment
        const instDateStr = `${instY}-${String(instM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Compare as strings — lexicographic date comparison works for YYYY-MM-DD
        if (instDateStr >= startDate && instDateStr <= endDate) {
            total += valorParcela;
        }
    }
    return total;
}
