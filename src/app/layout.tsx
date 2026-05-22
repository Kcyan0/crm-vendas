import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { ProjectProvider } from "@/context/ProjectContext";
import { ThemeProvider } from "@/context/ThemeContext";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "H SALES CRM",
  description: "Sistema de Gestão de Vendas para Closers e SDRs",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <head>
        {/* Anti-flash: aplica tema + modo antes do primeiro render */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('feracrm_theme') || 'verde';
              var m = localStorage.getItem('feracrm_mode')  || 'preto';
              var themes = {
                verde:    ['#BEFF00','#A8E800','190,255,0','#0A0A0A','#BEFF00'],
                ciano:    ['#22D3EE','#06B6D4','34,211,238','#0A0A0A','#22D3EE'],
                roxo:     ['#A78BFA','#8B5CF6','167,139,250','#0A0A0A','#A78BFA'],
                laranja:  ['#FB923C','#F97316','251,146,60','#0A0A0A','#FB923C'],
                vermelho: ['#EF4444','#DC2626','239,68,68','#FFFFFF','#EF4444'],
                branco:   ['#FFFFFF','#E5E5E5','255,255,255','#0A0A0A','#1A1A1A'],
              };
              var modes = {
                preto:  ['#111111','#0A0A0A','#1A1A1A','#222222','#2A2A2A','#FFFFFF','#888888','#555555','rgba(255,255,255,0.07)','#2A2A2A','#1E1E1E'],
                cinza:  ['#F0F2F5','#E4E6EA','#FFFFFF','#F5F7FA','#EBEDF0','#111111','#666666','#999999','rgba(0,0,0,0.08)','#D0D4DA','#D0D4DA'],
                branco: ['#FFFFFF','#FAFAFA','#F4F5F7','#EEEEF2','#E5E5EA','#0A0A0A','#555555','#888888','rgba(0,0,0,0.10)','#E0E0E0','#E8E8E8'],
              };
              var r = document.documentElement;
              // Accent
              var th = themes[t] || themes['verde'];
              if (m !== 'preto' && t === 'branco') th = ['#1A1A1A','#333333','26,26,26','#FFFFFF','#1A1A1A'];
              r.setAttribute('data-theme', t);
              r.style.setProperty('--accent',       th[0]);
              r.style.setProperty('--accent-hover', th[1]);
              r.style.setProperty('--accent-rgb',   th[2]);
              r.style.setProperty('--accent-text',  th[3]);
              r.style.setProperty('--logo-bg',      th[4]);
              // Mode
              var md = modes[m] || modes['preto'];
              r.setAttribute('data-mode', m);
              r.style.setProperty('--bg-app',         md[0]);
              r.style.setProperty('--bg-sidebar',     md[1]);
              r.style.setProperty('--bg-surface',     md[2]);
              r.style.setProperty('--bg-surface-2',   md[3]);
              r.style.setProperty('--bg-surface-3',   md[4]);
              r.style.setProperty('--text-pri',        md[5]);
              r.style.setProperty('--text-sec',        md[6]);
              r.style.setProperty('--text-muted',      md[7]);
              r.style.setProperty('--border',          md[8]);
              r.style.setProperty('--border-str',      md[9]);
              r.style.setProperty('--sidebar-border',  md[10]);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-app)' }}>
        <ThemeProvider>
          <ProjectProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </ProjectProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
