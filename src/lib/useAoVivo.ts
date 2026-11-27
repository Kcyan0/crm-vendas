"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";
import { CANAL_MUDANCAS, EVENTO_MUDANCA, type AvisoMudanca, type TipoMudanca } from "@/lib/mudancas";

/**
 * Lado das telas dos avisos em tempo real (ver src/lib/mudancas.ts): quando alguém salva,
 * a tela busca os dados de novo, sem F5.
 * - Uma conexão só para o CRM inteiro, dividida entre as telas que estão abertas.
 * - Vários avisos seguidos viram uma busca só (espera 1 s de calma).
 * - Aba escondida não busca: guarda que mudou e atualiza quando a pessoa volta.
 * - Se a conexão caiu e voltou (celular que dormiu, Wi-Fi que piscou), atualiza para não perder nada.
 */

type Ouvinte = (aviso: AvisoMudanca | null) => void; // null = reconectou, pode ter perdido avisos

const ouvintes = new Set<Ouvinte>();
let conectado = false;
let jaConectouAntes = false;

function ligarCanal() {
    if (conectado) return;
    conectado = true;
    createClient()
        .channel(CANAL_MUDANCAS)
        .on("broadcast", { event: EVENTO_MUDANCA }, ({ payload }) => {
            const aviso = payload as AvisoMudanca;
            if (!aviso || !Array.isArray(aviso.tipos)) return;
            ouvintes.forEach((ouvir) => ouvir(aviso));
        })
        .subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            if (jaConectouAntes) ouvintes.forEach((ouvir) => ouvir(null));
            jaConectouAntes = true;
        });
}

const ESPERA_MS = 1000;
// Aba escondida por mais que isso: ao voltar, atualiza mesmo sem aviso (o celular pode ter cortado a conexão)
const ESCONDIDA_MS = 60_000;

/**
 * @param tipos     quais mudanças interessam a esta tela
 * @param projeto   projeto da tela; "todos" para telas que juntam todos os projetos (Visão Geral)
 * @param atualizar busca os dados de novo, sem tela de carregando
 * @param pausar    enquanto devolver true, espera (ex.: card sendo arrastado)
 */
export function useAoVivo(
    tipos: TipoMudanca[],
    projeto: number | "todos" | null | undefined,
    atualizar: () => void,
    pausar?: () => boolean,
) {
    // Sempre a versão mais nova das funções, sem religar a escuta a cada render
    const atualizarRef = useRef(atualizar);
    const pausarRef = useRef(pausar);
    useEffect(() => {
        atualizarRef.current = atualizar;
        pausarRef.current = pausar;
    });
    const chaveTipos = tipos.join(",");

    useEffect(() => {
        if (projeto === null || projeto === undefined) return;
        const meusTipos = chaveTipos.split(",");
        let timer: ReturnType<typeof setTimeout> | undefined;
        let pendente = false;
        let escondidaDesde: number | null = document.hidden ? Date.now() : null;

        const rodar = () => {
            timer = undefined;
            if (document.hidden) { pendente = true; return; }
            if (pausarRef.current?.()) { timer = setTimeout(rodar, ESPERA_MS); return; }
            pendente = false;
            atualizarRef.current();
        };
        const agendar = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(rodar, ESPERA_MS);
        };

        const ouvir: Ouvinte = (aviso) => {
            if (aviso) {
                if (!aviso.tipos.some((t) => meusTipos.includes(t))) return;
                if (projeto !== "todos" && aviso.projeto !== null && aviso.projeto !== projeto) return;
            }
            agendar();
        };

        const aoMudarVisibilidade = () => {
            if (document.hidden) { escondidaDesde = Date.now(); return; }
            const ficouMuitoTempo = escondidaDesde !== null && Date.now() - escondidaDesde > ESCONDIDA_MS;
            escondidaDesde = null;
            if (pendente || ficouMuitoTempo) agendar();
        };

        ligarCanal();
        ouvintes.add(ouvir);
        document.addEventListener("visibilitychange", aoMudarVisibilidade);
        return () => {
            ouvintes.delete(ouvir);
            document.removeEventListener("visibilitychange", aoMudarVisibilidade);
            if (timer) clearTimeout(timer);
        };
    }, [chaveTipos, projeto]);
}
