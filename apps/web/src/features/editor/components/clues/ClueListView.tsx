import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, LayoutList, LayoutGrid } from 'lucide-react';
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
import { ClueForm } from '../ClueForm';
import { ClueCard } from '../ClueCard';
import { ClueListRow } from '../ClueListRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueListViewProps {
  themeId: string;
}

type ViewMode = 'list' | 'grid';

// ---------------------------------------------------------------------------
// ClueListView
// ---------------------------------------------------------------------------

export function ClueListView({ themeId }: ClueListViewProps) {
  const { data: clues, isLoading } = useEditorClues(themeId);
  const deleteClue = useDeleteClue(themeId);
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClue, setEditingClue] = useState<ClueResponse | undefined>(undefined);
  const [deletingClue, setDeletingClue] = useState<ClueResponse | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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
      onSuccess: () => { toast.success('단서가 삭제되었습니다'); setDeletingClue(undefined); },
      onError: (err) => { toast.error(err.message || '단서 삭제에 실패했습니다'); setDeletingClue(undefined); },
    });
  }

  function handleImageUploaded(_clueId: string, _url: string) {
    void queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>;
  }

  const isEmpty = !clues || clues.length === 0;

  return (
    <div className="px-4 py-6">
      {isEmpty ? (
        <div className="py-16 text-center">
          <div className="text-4xl font-mono font-bold text-slate-800 mb-2">0</div>
          <div className="text-xs font-mono uppercase tracking-widest text-slate-700 mb-4">단서 없음</div>
          <div className="text-xs text-slate-600 mb-6">단서를 추가하여 게임에 활용하세요</div>
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-1.5" />단서 추가</Button>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">{clues.length}개의 단서</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="리스트 뷰"
                className={`rounded p-1.5 transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400'}`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="그리드 뷰"
                className={`rounded p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="ml-2 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/20"
              >
                <Plus className="h-3.5 w-3.5" />추가
              </button>
            </div>
          </div>

          {/* List view */}
          {viewMode === 'list' ? (
            <div className="space-y-1.5">
              {clues.map((clue) => (
                <ClueListRow key={clue.id} clue={clue} onEdit={handleEdit} onDelete={setDeletingClue} />
              ))}
            </div>
          ) : (
            /* Grid view */
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
              <button
                type="button"
                onClick={handleCreate}
                className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-slate-800 p-6 text-slate-700 transition-colors hover:border-slate-600 hover:text-slate-500"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">단서 추가</span>
              </button>
            </div>
          )}
        </>
      )}

      <ClueForm themeId={themeId} clue={editingClue} isOpen={isFormOpen} onClose={handleFormClose} />

      <Modal
        isOpen={!!deletingClue}
        onClose={() => setDeletingClue(undefined)}
        title="단서 삭제"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingClue(undefined)} disabled={deleteClue.isPending}>취소</Button>
            <Button variant="danger" isLoading={deleteClue.isPending} onClick={handleDeleteConfirm}>삭제</Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{deletingClue?.name}</span> 단서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>
    </div>
  );
}
