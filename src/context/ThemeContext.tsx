"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "verde" | "ciano" | "roxo" | "laranja" | "vermelho" | "branco";

export const THEMES: Record<ThemeId, {
    label: string;
    accent: string;
    accentHover: string;
    accentRgb: string;
    accentText: string;
}> = {
    verde:    { label: "Verde Neon", accent: "#BEFF00", accentHover: "#A8E800", accentRgb: "190,255,0",   accentText: "#0A0A0A" },
    ciano:    { label: "Azul Ciano", accent: "#22D3EE", accentHover: "#06B6D4", accentRgb: "34,211,238",  accentText: "#0A0A0A" },
    roxo:     { label: "Roxo",       accent: "#A78BFA", accentHover: "#8B5CF6", accentRgb: "167,139,250", accentText: "#0A0A0A" },
    laranja:  { label: "Laranja",    accent: "#FB923C", accentHover: "#F97316", accentRgb: "251,146,60",  accentText: "#0A0A0A" },
    vermelho: { label: "Vermelho",   accent: "#EF4444", accentHover: "#DC2626", accentRgb: "239,68,68",   accentText: "#FFFFFF" },
    branco:   { label: "Branco",     accent: "#FFFFFF", accentHover: "#E5E5E5", accentRgb: "255,255,255", accentText: "#0A0A0A" },
};

const LS_KEY = "feracrm_theme";

interface ThemeCtx {
    theme: ThemeId;
    setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "verde", setTheme: () => {} });

function applyThemeToDom(t: ThemeId) {
    const def = THEMES[t];
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    root.style.setProperty("--accent", def.accent);
    root.style.setProperty("--accent-hover", def.accentHover);
    root.style.setProperty("--accent-rgb", def.accentRgb);
    root.style.setProperty("--accent-text", def.accentText);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>("verde");

    useEffect(() => {
        const stored = (localStorage.getItem(LS_KEY) as ThemeId) || "verde";
        const safe = THEMES[stored] ? stored : "verde";
        applyThemeToDom(safe);
        setThemeState(safe);
    }, []);

    function setTheme(t: ThemeId) {
        applyThemeToDom(t);
        localStorage.setItem(LS_KEY, t);
        setThemeState(t);
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
