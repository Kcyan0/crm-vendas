"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";
import { CANAL_MUDANCAS, EVENTO_MUDANCA, type AvisoMudanca, type TipoMudanca } from "@/lib/mudancas";

/**
 * Lado das telas dos avisos em tempo real (ver src/lib/mudancas.ts): quando alguém salva,
 * a tela busca os dados de novo, sem F5.
 * - Uma conexão só para o CRM inteiro, dividida entre as telas que estão abertas.
 * - Vários avisos seguidos viram uma busca só, juntando os leads que mudaram.
 * - Cada tela espera um tempo um pouco diferente (até 2 s a mais), para as telas da equipe
 *   não caírem todas no banco no mesmo segundo (2026-11-27, banco sobrecarregado).
 * - Telas pesadas (Dashboard, Visão Geral) pedem um intervalo mínimo entre buscas.
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
const ESPALHAR_MS = 2000;
// Aba escondida por mais que isso: ao voltar, atualiza mesmo sem aviso (o celular pode ter cortado a conexão)
const ESCONDIDA_MS = 60_000;
// Mais que isso de leads mudados de uma vez: busca a lista inteira
const MAX_LEADS = 30;

type Opcoes = {
    /** Enquanto devolver true, espera (ex.: card sendo arrastado). */
    pausar?: () => boolean;
    /** Tempo mínimo entre duas buscas desta tela (telas pesadas). */
    intervaloMinimoMs?: number;
};

/**
 * @param tipos     quais mudanças interessam a esta tela
 * @param projeto   projeto da tela; "todos" para telas que juntam todos os projetos (Visão Geral)
 * @param atualizar busca os dados de novo, sem tela de carregando. Recebe os ids dos leads que mudaram,
 *                  ou null quando não se sabe quais (aí busca tudo)
 */
export function useAoVivo(
    tipos: TipoMudanca[],
    projeto: number | "todos" | null | undefined,
    atualizar: (leads: number[] | null) => void,
    opcoes: Opcoes = {},
) {
    // Sempre a versão mais nova das funções, sem religar a escuta a cada render
    const atualizarRef = useRef(atualizar);
    const opcoesRef = useRef(opcoes);
    useEffect(() => {
        atualizarRef.current = atualizar;
        opcoesRef.current = opcoes;
    });
    const chaveTipos = tipos.join(",");

    useEffect(() => {
        if (projeto === null || projeto === undefined) return;
        const meusTipos = chaveTipos.split(",");
        let timer: ReturnType<typeof setTimeout> | undefined;
        let pendente = false;
        let leadsMudados: Set<number> | null = new Set(); // null = buscar tudo
        let ultimaBusca = 0;
        let escondidaDesde: number | null = document.hidden ? Date.now() : null;

        const rodar = () => {
            timer = undefined;
            if (document.hidden) { pendente = true; return; }
            if (opcoesRef.current.pausar?.()) { timer = setTimeout(rodar, ESPERA_MS); return; }
            const leads = leadsMudados && leadsMudados.size > 0 && leadsMudados.size <= MAX_LEADS ? [...leadsMudados] : null;
            pendente = false;
            leadsMudados = new Set();
            ultimaBusca = Date.now();
            atualizarRef.current(leads);
        };
        const agendar = () => {
            if (timer) clearTimeout(timer);
            const minimo = opcoesRef.current.intervaloMinimoMs ?? 0;
            const espera = Math.max(ESPERA_MS + Math.random() * ESPALHAR_MS, ultimaBusca + minimo - Date.now());
            timer = setTimeout(rodar, espera);
        };
        const anotar = (aviso: AvisoMudanca | null) => {
            if (!aviso || !aviso.leads?.length) leadsMudados = null;
            else if (leadsMudados) aviso.leads.forEach((id) => leadsMudados!.add(id));
        };

        const ouvir: Ouvinte = (aviso) => {
            if (aviso) {
                if (!aviso.tipos.some((t) => meusTipos.includes(t))) return;
                if (projeto !== "todos" && aviso.projeto !== null && aviso.projeto !== projeto) return;
            }
            anotar(aviso);
            agendar();
        };

        const aoMudarVisibilidade = () => {
            if (document.hidden) { escondidaDesde = Date.now(); return; }
            const ficouMuitoTempo = escondidaDesde !== null && Date.now() - escondidaDesde > ESCONDIDA_MS;
            escondidaDesde = null;
            if (ficouMuitoTempo) anotar(null);
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
