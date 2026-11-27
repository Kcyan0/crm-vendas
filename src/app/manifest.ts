import type { MetadataRoute } from 'next';

/**
 * Manifesto do app instalável (PWA), pedido em 2026-11-27: no celular o CRM vai para a tela inicial
 * com a logo e abre em tela cheia, sem a barra do navegador. É o mesmo site: cada deploy atualiza o app.
 * O ícone é fixo no verde da marca (o sistema copia o ícone na hora de instalar, não segue a cor escolhida).
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'H SALES CRM',
        short_name: 'H SALES',
        description: 'Sistema de Gestão de Vendas para Closers e SDRs',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Fundo e barra do Android enquanto o app abre: os do modo Preto, que é o padrão
        background_color: '#111111',
        theme_color: '#0A0A0A',
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}
