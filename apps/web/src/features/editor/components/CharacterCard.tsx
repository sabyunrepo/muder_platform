import { Trash2 } from 'lucide-react';
import type { EditorCharacterResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const CHARACTER_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
];

export function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

// ---------------------------------------------------------------------------
// CharacterCard
// ---------------------------------------------------------------------------

export interface CharacterCardProps {
  character: EditorCharacterResponse;
  index: number;
  onEdit: (character: EditorCharacterResponse) => void;
  onDelete: (character: EditorCharacterResponse) => void;
}

export function CharacterCard({ character, index, onEdit, onDelete }: CharacterCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(character)}
      onKeyDown={(e) => e.key === 'Enter' && onEdit(character)}
      className="group rounded-sm border border-slate-800 bg-slate-900 p-3 hover:border-slate-700 transition-all cursor-pointer focus:outline-none focus:border-amber-500/50"
    >
      <div className="flex items-start gap-3">
        <div
          className="relative h-10 w-10 shrink-0 rounded-full flex items-center justify-center"
          style={{ backgroundColor: getCharacterColor(index) }}
        >
          <span className="text-sm font-bold text-white font-mono">
            {character.name.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{character.name}</span>
            {character.is_culprit && (
              <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-sm">
                범인
              </span>
            )}
          </div>
          {character.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{character.description}</p>
          )}
        </div>
        <button
          type="button"
          className="p-1 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(character);
          }}
          aria-label={`${character.name} 삭제`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
