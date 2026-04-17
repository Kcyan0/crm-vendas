"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // Login com sucesso, forçar reload completo da página para limpar cache do Next.js
    // e recarregar os contextos (ProjectContext) do zero
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#111111] text-white">
      {/* Lado Esquerdo - Branding */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-[#0A0A0A] border-b md:border-b-0 md:border-r border-[rgba(255,255,255,0.05)] relative overflow-hidden">
        {/* Neon Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#BEFF00] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
        
        <div className="max-w-md w-full flex flex-col items-center text-center z-10">
          <div className="w-32 h-32 rounded-3xl overflow-hidden mb-8 border-4 border-[rgba(190,255,0,0.2)] shadow-[0_0_40px_rgba(190,255,0,0.1)]">
            <img src="/logo.png" alt="H SALES Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">
            H SALES <span className="text-[#BEFF00]">CRM</span>
          </h1>
          <p className="text-[#888] text-lg mb-8 leading-relaxed">
            Painel de Alta Performance para SDRs e Closers. Logue para acessar os projetos do seu e-mail.
          </p>
        </div>
      </div>

      {/* Lado Direito - Form de Login */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full glass-panel p-8">
          <h2 className="text-2xl font-bold mb-2">Bem-vindo de volta</h2>
          <p className="text-[#888] mb-8 text-sm">Insira suas credenciais para acessar sua conta.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#AAA] ml-1 uppercase text-[11px] tracking-wider">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#666]">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-[#222] border-none text-white rounded-xl focus:ring-2 focus:ring-[#BEFF00] focus:outline-none transition-all placeholder:text-[#555]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#AAA] ml-1 uppercase text-[11px] tracking-wider">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#666]">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-[#222] border-none text-white rounded-xl focus:ring-2 focus:ring-[#BEFF00] focus:outline-none transition-all placeholder:text-[#555]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-[#BEFF00] hover:bg-[#A8E800] text-[#0A0A0A] font-black py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Entrar no Sistema'}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-[#666]">
            Protegido por criptografia Supabase de ponta a ponta.
          </div>
        </div>
      </div>
    </div>
  )
}
