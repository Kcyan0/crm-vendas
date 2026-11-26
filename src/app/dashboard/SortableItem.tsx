import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';

const botaoCls = "p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white/50 hover:text-white transition-colors";

export function SortableItem({ id, block, isEditMode, oculto = false, onAlternarOculto }: {
    id: string; block: any; isEditMode: boolean; oculto?: boolean; onAlternarOculto?: (id: string) => void;
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
