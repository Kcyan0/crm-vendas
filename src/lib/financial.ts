// Strip "(Entrada)" / "(Parcelas)" suffixes so we get the base gateway name
export function baseGateway(forma: string): string {
    return (forma || 'PIX').replace(/ \(Entrada\)| \(Parcelas\)/g, '').trim();
}

/**
 * Calculate how much of a venda row's caixa falls within [startDate, endDate].
 * Uses data_recebimento (plain YYYY-MM-DD) to spread installments across months.
 * The comparison is purely date-based (no timezone math on the installment dates).
 */
export function caixaInPeriod(row: any, startDate: string, endDate: string): number {
    const parcelas = row.numero_parcelas || 1;
    const totalLiq = row.valor_liquido_caixa != null
        ? parseFloat(row.valor_liquido_caixa)
        : (parseFloat(row.valor_bruto) || 0);
    const valorParcela = totalLiq / parcelas;

    // data_recebimento is stored as YYYY-MM-DD (local date, no TZ)
    // Split to avoid any UTC-midnight ambiguity in new Date(string)
    const rawDate = (row.data_recebimento || (row.data_venda || '').substring(0, 10));
    if (!rawDate) return 0;
    
    // Ignore invalid formats just in case
    const dateParts = rawDate.split('-');
    if (dateParts.length < 3) return 0;
    
    const [y, m, d] = dateParts.map(Number);

    let total = 0;
    for (let i = 0; i < parcelas; i++) {
        // Compute Y-M-D of this installment (add i months, keeping same day)
        let instY = y;
        let instM = m - 1 + i; // zero-indexed month
        instY += Math.floor(instM / 12);
        instM = instM % 12;
        const instMonthStr = `${instY}-${String(instM + 1).padStart(2, '0')}`;
        const startMonth = startDate.substring(0, 7); // YYYY-MM
        const endMonth   = endDate.substring(0, 7);   // YYYY-MM

        if (instMonthStr >= startMonth && instMonthStr <= endMonth) {
            total += valorParcela;
        }
    }
    return total;
}
