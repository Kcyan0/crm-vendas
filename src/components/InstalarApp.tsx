"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Smartphone, Share, SquarePlus, X } from "lucide-react";

/**
 * Botão "Instalar app" do menu (pedido em 2026-11-27).
 * - Android e computador (Chrome, Edge): abre o pedido de instalação do próprio navegador.
 * - iPhone e iPad: o Safari não deixa o site pedir; mostra o passo a passo do "Adicionar à Tela de Início".
 * Some quando o CRM já está aberto como app instalado e onde não dá para instalar.
 */

type PedidoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
    interface Window { __pedidoInstalar?: PedidoInstalar; __appInstalado?: boolean }
}

const ehIOS = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad se apresenta como Mac

const jaInstalado = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

// O que o botão mostra: lido do navegador e relido a cada aviso (pedido de instalação chegou, app instalado)
type Estado = "escondido" | "pedido" | "ios";
const AVISO = "pedido-instalar";

function lerEstado(): Estado {
    if (window.__appInstalado || jaInstalado()) return "escondido";
    if (window.__pedidoInstalar) return "pedido";
    return ehIOS() ? "ios" : "escondido";
}

function assinar(avisar: () => void) {
    const aoInstalar = () => { window.__appInstalado = true; window.__pedidoInstalar = undefined; avisar(); };
    window.addEventListener(AVISO, avisar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
        window.removeEventListener(AVISO, avisar);
        window.removeEventListener("appinstalled", aoInstalar);
    };
}

export default function InstalarApp() {
    // No servidor não há navegador: começa escondido
    const estado = useSyncExternalStore(assinar, lerEstado, () => "escondido" as Estado);
    const [passoAPasso, setPassoAPasso] = useState(false);

    if (estado === "escondido") return null;

    const instalar = async () => {
        const pedido = window.__pedidoInstalar;
        if (!pedido) { setPassoAPasso(true); return; }
        await pedido.prompt();
        const { outcome } = await pedido.userChoice;
        // O pedido do navegador só vale uma vez; se a pessoa recusar, o navegador oferece de novo mais tarde
        window.__pedidoInstalar = undefined;
        if (outcome === "accepted") window.__appInstalado = true;
        window.dispatchEvent(new Event(AVISO));
    };

    return (
        <>
            <button
                type="button"
                onClick={instalar}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl w-full transition-all mb-1"
                style={{ color: 'var(--text-sec)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-pri)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sec)'; }}
            >
                <Smartphone size={18} />
                <span className="font-semibold text-sm flex-1 text-left">Instalar app</span>
            </button>

            {/* Portal: o menu lateral é deslizante (transform) e prenderia a janela dentro dele */}
            {passoAPasso && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60"
                    onClick={() => setPassoAPasso(false)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="instalar-titulo"
                        className="modal-surface w-full max-w-sm rounded-2xl p-6 relative"
                        style={{ border: '1px solid var(--border-str)', color: 'var(--text-pri)' }}
                        onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => setPassoAPasso(false)} aria-label="Fechar"
                            className="absolute top-4 right-4 text-sec hover:text-pri transition-colors">
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-3 mb-5">
                            <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
                            <div>
                                <h2 id="instalar-titulo" className="font-black text-lg leading-tight">Instalar no iPhone</h2>
                                <p className="text-sm text-sec">O CRM fica na tela inicial, como um app.</p>
                            </div>
                        </div>
                        <ol className="space-y-3 text-sm">
                            <li className="flex items-start gap-3">
                                <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black bg-accent" style={{ color: 'var(--accent-text)' }}>1</span>
                                <span>No Safari, toque em <strong>Compartilhar</strong> <Share size={15} className="inline -mt-1 text-accent" aria-label="ícone Compartilhar" />. Se não aparecer, ele fica no botão <strong>•••</strong>.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black bg-accent" style={{ color: 'var(--accent-text)' }}>2</span>
                                <span>Role a lista e toque em <strong>Adicionar à Tela de Início</strong> <SquarePlus size={15} className="inline -mt-1 text-accent" aria-label="ícone Adicionar" />.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black bg-accent" style={{ color: 'var(--accent-text)' }}>3</span>
                                <span>Toque em <strong>Adicionar</strong>. Na primeira vez que abrir pelo ícone, entre com seu e-mail e senha.</span>
                            </li>
                        </ol>
                        <button type="button" onClick={() => setPassoAPasso(false)} className="btn-primary w-full mt-6">
                            Entendi
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
