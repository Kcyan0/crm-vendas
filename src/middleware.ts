import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest, sw.js e offline.html: arquivos do app instalável, que o celular
     *   busca sem estar logado (sem isto iriam para /login e a instalação quebrava)
     * - api: o middleware deixava toda rota de API passar e só gastava uma consulta ao login
     *   do Supabase (que lê o banco) a cada chamada; as rotas que exigem login já conferem
     *   sozinhas (2026-11-27, banco no limite de disco do plano grátis)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
