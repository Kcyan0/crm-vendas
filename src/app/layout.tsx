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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.className}>
      {/* Anti-flash script: reads localStorage and applies data-theme BEFORE first paint */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('feracrm_theme');
              var themes = { verde:['#BEFF00','#A8E800','190,255,0','#0A0A0A'], ciano:['#22D3EE','#06B6D4','34,211,238','#0A0A0A'], roxo:['#A78BFA','#8B5CF6','167,139,250','#0A0A0A'], laranja:['#FB923C','#F97316','251,146,60','#0A0A0A'], vermelho:['#EF4444','#DC2626','239,68,68','#FFFFFF'], branco:['#FFFFFF','#E5E5E5','255,255,255','#0A0A0A'] };
              var def = themes[t] || themes['verde'];
              var r = document.documentElement;
              r.setAttribute('data-theme', t || 'verde');
              r.style.setProperty('--accent', def[0]);
              r.style.setProperty('--accent-hover', def[1]);
              r.style.setProperty('--accent-rgb', def[2]);
              r.style.setProperty('--accent-text', def[3]);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="flex h-screen overflow-hidden">
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
