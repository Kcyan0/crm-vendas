import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Minus, Plus } from 'lucide-react';
import { NOME_LARGURA, type Largura } from './larguraQuadro';

const botaoCls = "p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white/50 hover:text-white transition-colors";
const botaoLarguraCls = "p-2 text-white/60 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:text-white/60";

export function SortableItem({ id, block, isEditMode, oculto = false, onAlternarOculto, largura, onMudarLargura }: {
    id: string; block: any; isEditMode: boolean; oculto?: boolean; onAlternarOculto?: (id: string) => void;
    largura?: Largura; onMudarLargura?: (id: string, largura: Largura) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isEditMode && transform ? 1000 : 1, // Elevate during drag
        position: 'relative' as any,
    };

    // Quadro oculto some da Dashboard; no modo Layout aparece apagado, para poder mostrar de novo
    if (oculto && !isEditMode) return null;
    const content = block.render();
    if (!content) return null;

    return (
        <div ref={setNodeRef} style={style} className={`${block.colSpan} relative group`}>
            {isEditMode && (
                <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5">
                    {oculto && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide pointer-events-none"
                            style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>
                            Oculto
                        </span>
                    )}
                    {/* Largura: quantas das 4 colunas da tela grande o quadro ocupa */}
                    {onMudarLargura && largura && (
                        <div role="group" aria-label={`Largura do quadro: ${NOME_LARGURA[largura]}`}
                            className="flex items-center bg-black/50 rounded-lg">
                            <button type="button" onClick={() => onMudarLargura(id, (largura - 1) as Largura)} disabled={largura <= 1}
                                title="Diminuir largura" aria-label="Diminuir largura" className={botaoLarguraCls}>
                                <Minus size={16} />
                            </button>
                            <span className="text-[11px] font-bold tabular-nums text-white min-w-[26px] text-center select-none"
                                title={`Ocupa ${NOME_LARGURA[largura]} na tela grande`}>
                                {largura}/4
                            </span>
                            <button type="button" onClick={() => onMudarLargura(id, (largura + 1) as Largura)} disabled={largura >= 4}
                                title="Aumentar largura" aria-label="Aumentar largura" className={botaoLarguraCls}>
                                <Plus size={16} />
                            </button>
                        </div>
                    )}
                    {onAlternarOculto && (
                        <button
                            type="button"
                            onClick={() => onAlternarOculto(id)}
                            title={oculto ? 'Mostrar quadro' : 'Ocultar quadro'}
                            aria-label={oculto ? 'Mostrar quadro' : 'Ocultar quadro'}
                            aria-pressed={oculto}
                            className={botaoCls}
                        >
                            {oculto ? <Eye size={20} /> : <EyeOff size={20} />}
                        </button>
                    )}
                    <div
                        {...attributes}
                        {...listeners}
                        className={`${botaoCls} cursor-grab active:cursor-grabbing`}
                    >
                        <GripVertical size={20} />
                    </div>
                </div>
            )}
            <div className={isEditMode ? `${oculto ? 'opacity-30 grayscale' : 'opacity-80'} pointer-events-none` : ''}>
                {content}
            </div>
            {isEditMode && (
                <div className="absolute inset-0 border-2 border-dashed border-accent-30 rounded-xl pointer-events-none z-40 bg-accent-5 transition-opacity" />
            )}
        </div>
    );
}
