import Link from "next/link";
import { SearchX } from "lucide-react";

// Endereço que não existe: antes aparecia a página padrão do Next, em inglês ("This page could not be found")
export default function NaoEncontrada() {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="glass-panel max-w-md w-full p-8 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                    <SearchX size={26} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Erro 404</p>
                <h2 className="text-2xl font-black tracking-tight mb-2" style={{ color: 'var(--text-pri)' }}>Página não encontrada</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-sec)' }}>
                    O endereço pode ter mudado ou estar digitado errado.
                </p>
                <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                    Voltar ao Quadro de Leads
                </Link>
            </div>
        </div>
    );
}
