import { useState } from 'react';
import { Trash2, Image } from 'lucide-react';
import type { ClueResponse } from '@/features/editor/api';
import { ImageUpload } from './ImageUpload';

// ---------------------------------------------------------------------------
// ClueCard — grid view item with compact no-image mode
// ---------------------------------------------------------------------------

interface ClueCardProps {
  clue: ClueResponse;
  themeId: string;
  onEdit: (clue: ClueResponse) => void;
  onDelete: (clue: ClueResponse) => void;
  onImageUploaded: (clueId: string, url: string) => void;
}

export function ClueCard({ clue, themeId, onEdit, onDelete, onImageUploaded }: ClueCardProps) {
  const [showImageUpload, setShowImageUpload] = useState(false);

  return (
    <div className="group rounded-sm border border-slate-800 bg-slate-900 transition-all hover:border-slate-700">
      {/* Full 16:9 image thumbnail — only when image exists */}
      {clue.image_url ? (
        <div
          className="relative cursor-pointer overflow-hidden rounded-t-sm"
          style={{ aspectRatio: '16/9' }}
          onClick={() => setShowImageUpload((v) => !v)}
        >
          <img src={clue.image_url} alt={clue.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-sm bg-slate-800/90 px-2 py-1 text-[11px] font-medium text-slate-200">
              이미지 변경
            </span>
          </div>
        </div>
      ) : null}

      {/* Inline image upload (toggled) */}
      {showImageUpload && (
        <div className="border-t border-slate-800 p-3">
          <ImageUpload
            themeId={themeId}
            targetId={clue.id}
            target="clue"
            currentImageUrl={clue.image_url}
            onUploaded={(url) => { onImageUploaded(clue.id, url); setShowImageUpload(false); }}
            aspectRatio="16/9"
          />
        </div>
      )}

      {/* Card body */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(clue)}
        onKeyDown={(e) => e.key === 'Enter' && onEdit(clue)}
        className="flex cursor-pointer items-start justify-between gap-2 p-3 focus:outline-none"
      >
        <div className="min-w-0 flex-1">
          {/* Compact placeholder when no image */}
          {!clue.image_url && (
            <div
              className="mb-2 flex items-center justify-center rounded-sm bg-slate-800"
              style={{ height: '36px' }}
              onClick={(e) => { e.stopPropagation(); setShowImageUpload((v) => !v); }}
            >
              <Image className="h-4 w-4 text-slate-700" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-200">{clue.name}</span>
            {clue.is_common && (
              <span className="shrink-0 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                공통
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600">{clue.clue_type}</span>
            <span className="text-[11px] text-slate-700">·</span>
            <span className="text-[11px] text-slate-600">Lv.{clue.level}</span>
          </div>
          {clue.description && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{clue.description}</p>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 p-1 text-slate-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete(clue); }}
          aria-label={`${clue.name} 삭제`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
