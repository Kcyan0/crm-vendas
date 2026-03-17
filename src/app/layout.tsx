import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { ProjectProvider } from "@/context/ProjectContext";

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
      <body className="flex h-screen overflow-hidden">
        <ProjectProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ProjectProvider>
      </body>
    </html>
  );
}
