/**
 * Utilitários de exportação para CSV (planilha)
 */

type Row = Record<string, unknown>;

function toCSV(headers: { key: string; label: string }[], rows: Row[]): string {
    const escape = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str}"`;
        }
        return str;
    };

    const headerRow = headers.map(h => escape(h.label)).join(',');
    const dataRows = rows.map(row =>
        headers.map(h => escape(row[h.key])).join(',')
    );

    return [headerRow, ...dataRows].join('\n');
}

function downloadCSV(csvContent: string, filename: string): void {
    // BOM para Excel reconhecer UTF-8 corretamente
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export function exportLeadsToCSV(leads: Row[]): void {
    const headers = [
        { key: 'id_lead', label: 'ID' },
        { key: 'nome', label: 'Nome' },
        { key: 'telefone', label: 'Telefone' },
        { key: 'instagram', label: 'Instagram' },
        { key: 'email', label: 'E-mail' },
        { key: 'origem', label: 'Origem' },
        { key: 'status_atual', label: 'Status' },
        { key: 'sdr_nome', label: 'SDR' },
        { key: 'closer_nome', label: 'Closer' },
        { key: 'valor_proposta', label: 'Valor Proposta (R$)' },
        { key: 'observacoes_gerais', label: 'Observações' },
        { key: 'data_entrada', label: 'Data de Entrada' },
    ];

    const csv = toCSV(headers, leads);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `leads_${date}.csv`);
}

export function exportVendasToCSV(vendas: Row[]): void {
    const headers = [
        { key: 'id_venda', label: 'ID Venda' },
        { key: 'lead_nome', label: 'Lead' },
        { key: 'sdr_nome', label: 'SDR' },
        { key: 'closer_nome', label: 'Closer' },
        { key: 'valor_bruto', label: 'Valor Bruto (R$)' },
        { key: 'desconto_concedido', label: 'Desconto (R$)' },
        { key: 'valor_liquido_caixa', label: 'Valor Líquido (R$)' },
        { key: 'forma_pagamento', label: 'Forma de Pagamento' },
        { key: 'numero_parcelas', label: 'Parcelas' },
        { key: 'taxa_gateway', label: 'Taxa Gateway (R$)' },
        { key: 'status_pagamento', label: 'Status Pagamento' },
        { key: 'data_venda', label: 'Data da Venda' },
    ];

    const csv = toCSV(headers, vendas);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `vendas_${date}.csv`);
}
