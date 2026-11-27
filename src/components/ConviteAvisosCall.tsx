"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, Loader2 } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { VAPID_CHAVE_PUBLICA } from "@/lib/pushChave";

/**
 * Convite dos avisos no celular (2026-11-27): ao entrar no CRM, pergunta uma vez se a pessoa quer
 * receber os avisos (resumo das calls às 9h, 1 hora antes de cada call e vendas do time; regras em
 * src/lib/avisosPush.ts). Sem item novo no menu (pedido em 2026-11-27).
 * O pedido de permissão do celular sai do toque em "Ativar": o iPhone só deixa pedir depois de um toque.
 * - "Agora não": pergunta de novo em 7 dias.
 * - Já permitiu: confere a cada abertura que o aparelho está guardado no e-mail de quem está logado.
 * - Bloqueou ou o aparelho não tem suporte (iPhone fora do app instalado): não aparece.
 * Para parar de receber: ajustes de notificação do celular ou do navegador.
 */

const ADIADO = "feracrm_avisos_call_adiado";
const SINCRONIZADO = "feracrm_avisos_call_ok";
const ADIAR_MS = 7 * 24 * 60 * 60 * 1000;

const temSuporte = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const lerLocal = (chave: string) => { try { return localStorage.getItem(chave); } catch { return null; } };
const gravarLocal = (chave: string, valor: string) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento: pergunta de novo */ } };

// A chave pública vem em base64 de URL; o navegador quer os bytes
function chaveEmBytes(base64: string): Uint8Array<ArrayBuffer> {
    const comPreenchimento = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const texto = atob(comPreenchimento);
    const bytes = new Uint8Array(new ArrayBuffer(texto.length));
    for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
    return bytes;
}

/** Garante a inscrição deste aparelho e que o servidor a tem no e-mail de quem está logado. */
async function sincronizar(email: string) {
    const registro = await navigator.serviceWorker.ready;
    const inscricao = (await registro.pushManager.getSubscription())
        ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(VAPID_CHAVE_PUBLICA) }));
    const marca = `${email}|${inscricao.endpoint}`;
    if (lerLocal(SINCRONIZADO) === marca) return;
    const res = await fetch("/api/push/inscrever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inscricao: inscricao.toJSON() }),
    });
    if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        throw new Error(corpo.error || "Não foi possível ativar os avisos.");
    }
    gravarLocal(SINCRONIZADO, marca);
}

export default function ConviteAvisosCall() {
    const naLogin = usePathname() === "/login";
    const { user } = useProject();
    const email = user?.email?.trim().toLowerCase() ?? null;
    const [mostrar, setMostrar] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    useEffect(() => {
        if (!email || naLogin || !temSuporte()) return;
        let ativo = true;
        // Espera a tela abrir antes de aparecer
        const timer = setTimeout(() => {
            if (Notification.permission === "granted") {
                sincronizar(email).catch(() => { /* tenta de novo na próxima abertura */ });
                return;
            }
            if (Notification.permission === "denied") return;
            if (Date.now() - Number(lerLocal(ADIADO) || 0) < ADIAR_MS) return;
            if (ativo) setMostrar(true);
        }, 2500);
        return () => { ativo = false; clearTimeout(timer); };
    }, [email, naLogin]);

    if (!mostrar || !email) return null;

    const adiar = () => {
        gravarLocal(ADIADO, String(Date.now()));
        setMostrar(false);
    };

    const ativar = async () => {
        setOcupado(true);
        setErro(null);
        try {
            const permissao = await Notification.requestPermission();
            if (permissao === "default") { adiar(); return; } // fechou o pedido sem escolher
            if (permissao === "granted") await sincronizar(email);
            setMostrar(false);
        } catch {
            setErro("Não deu para ativar agora. O CRM tenta de novo na próxima vez que você abrir.");
        } finally {
            setOcupado(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-labelledby="convite-avisos-titulo"
            className="modal-surface fixed z-[90] left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] rounded-2xl p-4 shadow-2xl"
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))", border: "1px solid var(--border-str)" }}
        >
            <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-accent-12">
                    <BellRing size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                    <p id="convite-avisos-titulo" className="font-bold text-sm" style={{ color: "var(--text-pri)" }}>Avisos no celular</p>
                    <p className="text-sm mt-0.5" style={{ color: "var(--text-sec)" }}>
                        Quer receber o resumo das suas calls às 9h, um aviso 1 hora antes de cada call e as vendas do time?
                    </p>
                    {erro && <p className="text-xs mt-2" style={{ color: "#ef4444" }}>{erro}</p>}
                </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
                <button type="button" onClick={adiar} disabled={ocupado}
                    className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors" style={{ color: "var(--text-sec)" }}>
                    {erro ? "Fechar" : "Agora não"}
                </button>
                {!erro && (
                    <button type="button" onClick={ativar} disabled={ocupado}
                        className="btn-primary text-sm flex items-center gap-2" style={{ padding: "8px 16px" }}>
                        {ocupado && <Loader2 size={14} className="animate-spin" />}
                        Ativar
                    </button>
                )}
            </div>
        </div>
    );
}
