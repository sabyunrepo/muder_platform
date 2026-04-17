import { Trash2 } from 'lucide-react';
import type { ClueResponse } from '@/features/editor/api';
import { formatRoundRange } from '@/features/editor/utils/roundFormat';

// ---------------------------------------------------------------------------
// ClueListRow
// ---------------------------------------------------------------------------

interface ClueListRowProps {
  clue: ClueResponse;
  onEdit: (clue: ClueResponse) => void;
  onDelete: (clue: ClueResponse) => void;
}

export function ClueListRow({ clue, onEdit, onDelete }: ClueListRowProps) {
  const roundLabel = formatRoundRange(clue.reveal_round, clue.hide_round);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(clue)}
      onKeyDown={(e) => e.key === 'Enter' && onEdit(clue)}
      className="group flex cursor-pointer items-center gap-3 rounded-sm border border-slate-800 bg-slate-900 px-3 py-2 transition-all hover:border-slate-700 focus:outline-none"
    >
      {/* Name */}
      <span className="flex-1 truncate text-sm font-medium text-slate-200">{clue.name}</span>

      {/* Round range badge — hidden when unbounded on both sides */}
      {roundLabel && (
        <span
          aria-label="라운드 범위"
          className="shrink-0 rounded-sm border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
        >
          {roundLabel}
        </span>
      )}

      {/* Common badge */}
      {clue.is_common && (
        <span className="shrink-0 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
          공통
        </span>
      )}

      {/* Delete */}
      <button
        type="button"
        className="shrink-0 p-1 text-slate-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(clue);
        }}
        aria-label={`${clue.name} 삭제`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
