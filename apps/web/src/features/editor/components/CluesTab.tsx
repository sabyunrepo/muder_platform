import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Image } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import {
  useEditorClues,
  useDeleteClue,
  editorKeys,
  type ClueResponse,
} from '@/features/editor/api';
import { ClueForm } from './ClueForm';
import { ImageUpload } from './ImageUpload';

// ---------------------------------------------------------------------------
// ClueCard
// ---------------------------------------------------------------------------

interface ClueCardProps {
  clue: ClueResponse;
  themeId: string;
  onEdit: (clue: ClueResponse) => void;
  onDelete: (clue: ClueResponse) => void;
  onImageUploaded: (clueId: string, url: string) => void;
}

function ClueCard({ clue, themeId, onEdit, onDelete, onImageUploaded }: ClueCardProps) {
  const [showImageUpload, setShowImageUpload] = useState(false);

  return (
    <div className="group rounded-sm border border-slate-800 bg-slate-900 transition-all hover:border-slate-700">
      {/* Image thumbnail */}
      <div
        className="relative cursor-pointer overflow-hidden rounded-t-sm"
        style={{ aspectRatio: '16/9' }}
        onClick={() => setShowImageUpload((v) => !v)}
      >
        {clue.image_url ? (
          <img
            src={clue.image_url}
            alt={clue.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800">
            <Image className="h-6 w-6 text-slate-700" />
          </div>
        )}
        {/* Image upload toggle overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-sm bg-slate-800/90 px-2 py-1 text-[11px] font-medium text-slate-200">
            {clue.image_url ? '이미지 변경' : '이미지 추가'}
          </span>
        </div>
      </div>

      {/* Inline image upload (toggled) */}
      {showImageUpload && (
        <div className="border-t border-slate-800 p-3">
          <ImageUpload
            themeId={themeId}
            targetId={clue.id}
            target="clue"
            currentImageUrl={clue.image_url}
            onUploaded={(url) => {
              onImageUploaded(clue.id, url);
              setShowImageUpload(false);
            }}
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
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-200">{clue.name}</span>
            {clue.is_common && (
              <span className="shrink-0 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                공통
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600">
              {clue.clue_type}
            </span>
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
          onClick={(e) => {
            e.stopPropagation();
            onDelete(clue);
          }}
          aria-label={`${clue.name} 삭제`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CluesTab
// ---------------------------------------------------------------------------

interface CluesTabProps {
  themeId: string;
}

export function CluesTab({ themeId }: CluesTabProps) {
  const { data: clues, isLoading } = useEditorClues(themeId);
  const deleteClue = useDeleteClue(themeId);
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClue, setEditingClue] = useState<ClueResponse | undefined>(undefined);
  const [deletingClue, setDeletingClue] = useState<ClueResponse | undefined>(undefined);

  function handleCreate() {
    setEditingClue(undefined);
    setIsFormOpen(true);
  }

  function handleEdit(clue: ClueResponse) {
    setEditingClue(clue);
    setIsFormOpen(true);
  }

  function handleFormClose() {
    setIsFormOpen(false);
    setEditingClue(undefined);
  }

  function handleDeleteConfirm() {
    if (!deletingClue) return;
    deleteClue.mutate(deletingClue.id, {
      onSuccess: () => {
        toast.success('단서가 삭제되었습니다');
        setDeletingClue(undefined);
      },
      onError: (err) => {
        toast.error(err.message || '단서 삭제에 실패했습니다');
        setDeletingClue(undefined);
      },
    });
  }

  // After inline image upload via ClueCard, invalidate the clues query so the
  // new image_url is reflected without a full page reload.
  function handleImageUploaded(_clueId: string, _url: string) {
    void queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const isEmpty = !clues || clues.length === 0;

  return (
    <div className="px-4 py-6">
      {isEmpty ? (
        <div className="py-16 text-center">
          <div className="text-4xl font-mono font-bold text-slate-800 mb-2">0</div>
          <div className="text-xs font-mono uppercase tracking-widest text-slate-700 mb-4">
            단서 없음
          </div>
          <div className="text-xs text-slate-600 mb-6">단서를 추가하여 게임에 활용하세요</div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            단서 추가
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clues.map((clue) => (
            <ClueCard
              key={clue.id}
              clue={clue}
              themeId={themeId}
              onEdit={handleEdit}
              onDelete={setDeletingClue}
              onImageUploaded={handleImageUploaded}
            />
          ))}

          {/* Add card */}
          <button
            type="button"
            onClick={handleCreate}
            className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-slate-800 p-6 text-slate-700 transition-colors hover:border-slate-600 hover:text-slate-500"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">단서 추가</span>
          </button>
        </div>
      )}

      <ClueForm
        themeId={themeId}
        clue={editingClue}
        isOpen={isFormOpen}
        onClose={handleFormClose}
      />

      <Modal
        isOpen={!!deletingClue}
        onClose={() => setDeletingClue(undefined)}
        title="단서 삭제"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeletingClue(undefined)}
              disabled={deleteClue.isPending}
            >
              취소
            </Button>
            <Button
              variant="danger"
              isLoading={deleteClue.isPending}
              onClick={handleDeleteConfirm}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{deletingClue?.name}</span> 단서를
          삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>
    </div>
  );
}
