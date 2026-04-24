import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export function SortableItem({ id, block, isEditMode }: { id: string; block: any; isEditMode: boolean }) {
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

    const content = block.render();
    if (!content) return null;

    return (
        <div ref={setNodeRef} style={style} className={`${block.colSpan} relative group`}>
            {isEditMode && (
                <div 
                    {...attributes} 
                    {...listeners}
                    className="absolute top-2 right-2 z-50 p-2 cursor-grab active:cursor-grabbing bg-black/50 hover:bg-black/80 rounded-lg text-white/50 hover:text-white transition-colors"
                >
                    <GripVertical size={20} />
                </div>
            )}
            <div className={isEditMode ? 'opacity-80 pointer-events-none' : ''}>
                {content}
            </div>
            {isEditMode && (
                <div className="absolute inset-0 border-2 border-dashed border-[#BEFF00]/30 rounded-xl pointer-events-none z-40 bg-[#BEFF00]/5 transition-opacity" />
            )}
        </div>
    );
}
