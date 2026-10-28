import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Meu Time e Produtos agora são abas de Configurações
  async redirects() {
    return [
      { source: "/team", destination: "/settings?aba=time", permanent: false },
      { source: "/products", destination: "/settings?aba=produtos", permanent: false },
    ];
  },
};

export default nextConfig;
