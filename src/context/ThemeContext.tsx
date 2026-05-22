"use client";

import { createContext, useContext, useEffect, useState } from "react";

// ─── Accent Themes ────────────────────────────────────────────────────────────
export type ThemeId = "verde" | "ciano" | "roxo" | "laranja" | "vermelho" | "branco";

export const THEMES: Record<ThemeId, {
    label: string; accent: string; accentHover: string;
    accentRgb: string; accentText: string; logoBg: string;
}> = {
    verde:    { label: "Verde Neon", accent: "#BEFF00", accentHover: "#A8E800", accentRgb: "190,255,0",   accentText: "#0A0A0A", logoBg: "#BEFF00" },
    ciano:    { label: "Azul Ciano", accent: "#22D3EE", accentHover: "#06B6D4", accentRgb: "34,211,238",  accentText: "#0A0A0A", logoBg: "#22D3EE" },
    roxo:     { label: "Roxo",       accent: "#A78BFA", accentHover: "#8B5CF6", accentRgb: "167,139,250", accentText: "#0A0A0A", logoBg: "#A78BFA" },
    laranja:  { label: "Laranja",    accent: "#FB923C", accentHover: "#F97316", accentRgb: "251,146,60",  accentText: "#0A0A0A", logoBg: "#FB923C" },
    vermelho: { label: "Vermelho",   accent: "#EF4444", accentHover: "#DC2626", accentRgb: "239,68,68",   accentText: "#FFFFFF", logoBg: "#EF4444" },
    branco:   { label: "Branco",     accent: "#FFFFFF", accentHover: "#E5E5E5", accentRgb: "255,255,255", accentText: "#0A0A0A", logoBg: "#1A1A1A" },
};

// ─── Background Modes ─────────────────────────────────────────────────────────
export type ModeId = "preto" | "cinza" | "branco";

export const MODES: Record<ModeId, {
    label: string;
    bgApp: string; bgSidebar: string; bgSurface: string;
    bgSurface2: string; bgSurface3: string;
    textPri: string; textSec: string; textMuted: string;
    border: string; borderStr: string; sidebarBorder: string;
}> = {
    preto: {
        label: "Preto",
        bgApp: "#111111", bgSidebar: "#0A0A0A", bgSurface: "#1A1A1A",
        bgSurface2: "#222222", bgSurface3: "#2A2A2A",
        textPri: "#FFFFFF", textSec: "#888888", textMuted: "#555555",
        border: "rgba(255,255,255,0.07)", borderStr: "#2A2A2A", sidebarBorder: "#1E1E1E",
    },
    cinza: {
        label: "Cinza",
        bgApp: "#F0F2F5", bgSidebar: "#E4E6EA", bgSurface: "#FFFFFF",
        bgSurface2: "#F5F7FA", bgSurface3: "#EBEDF0",
        textPri: "#111111", textSec: "#666666", textMuted: "#999999",
        border: "rgba(0,0,0,0.08)", borderStr: "#D0D4DA", sidebarBorder: "#D0D4DA",
    },
    branco: {
        label: "Branco",
        bgApp: "#FFFFFF", bgSidebar: "#FAFAFA", bgSurface: "#F4F5F7",
        bgSurface2: "#EEEEF2", bgSurface3: "#E5E5EA",
        textPri: "#0A0A0A", textSec: "#555555", textMuted: "#888888",
        border: "rgba(0,0,0,0.10)", borderStr: "#E0E0E0", sidebarBorder: "#E8E8E8",
    },
};

const LS_THEME = "feracrm_theme";
const LS_MODE  = "feracrm_mode";

// Accent "branco" em modo claro → vira escuro automaticamente
function resolveAccent(t: ThemeId, m: ModeId) {
    if (m !== "preto" && t === "branco") {
        return { accent: "#1A1A1A", accentHover: "#333333", accentRgb: "26,26,26", accentText: "#FFFFFF", logoBg: "#1A1A1A" };
    }
    return THEMES[t];
}

export function applyThemeToDom(t: ThemeId, m: ModeId) {
    const acc = resolveAccent(t, m);
    const mod = MODES[m];
    const root = document.documentElement;
    // Accent
    root.setAttribute("data-theme", t);
    root.style.setProperty("--accent",       acc.accent);
    root.style.setProperty("--accent-hover", acc.accentHover);
    root.style.setProperty("--accent-rgb",   acc.accentRgb);
    root.style.setProperty("--accent-text",  acc.accentText);
    root.style.setProperty("--logo-bg",      acc.logoBg);
    // Mode
    root.setAttribute("data-mode", m);
    root.style.setProperty("--bg-app",        mod.bgApp);
    root.style.setProperty("--bg-sidebar",    mod.bgSidebar);
    root.style.setProperty("--bg-surface",    mod.bgSurface);
    root.style.setProperty("--bg-surface-2",  mod.bgSurface2);
    root.style.setProperty("--bg-surface-3",  mod.bgSurface3);
    root.style.setProperty("--text-pri",      mod.textPri);
    root.style.setProperty("--text-sec",      mod.textSec);
    root.style.setProperty("--text-muted",    mod.textMuted);
    root.style.setProperty("--border",        mod.border);
    root.style.setProperty("--border-str",    mod.borderStr);
    root.style.setProperty("--sidebar-border",mod.sidebarBorder);
}

interface ThemeCtx {
    theme: ThemeId; mode: ModeId;
    setTheme: (t: ThemeId) => void;
    setMode:  (m: ModeId)  => void;
}

const ThemeContext = createContext<ThemeCtx>({
    theme: "verde", mode: "preto", setTheme: () => {}, setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>("verde");
    const [mode,  setModeState]  = useState<ModeId>("preto");

    useEffect(() => {
        const storedTheme = (localStorage.getItem(LS_THEME) as ThemeId) || "verde";
        const storedMode  = (localStorage.getItem(LS_MODE)  as ModeId)  || "preto";
        const safeTheme = THEMES[storedTheme] ? storedTheme : "verde";
        const safeMode  = MODES[storedMode]   ? storedMode  : "preto";
        applyThemeToDom(safeTheme, safeMode);
        setThemeState(safeTheme);
        setModeState(safeMode);
    }, []);

    function setTheme(t: ThemeId) {
        applyThemeToDom(t, mode);
        localStorage.setItem(LS_THEME, t);
        setThemeState(t);
    }

    function setMode(m: ModeId) {
        applyThemeToDom(theme, m);
        localStorage.setItem(LS_MODE, m);
        setModeState(m);
    }

    return (
        <ThemeContext.Provider value={{ theme, mode, setTheme, setMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
