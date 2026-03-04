import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ProjectProvider } from "@/context/ProjectContext";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "FERACRM",
  description: "Sistema de Gestão de Vendas Premium para Closers e SDRs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="flex h-screen overflow-hidden">
        <ProjectProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
            {children}
          </main>
        </ProjectProvider>
      </body>
    </html>
  );
}
