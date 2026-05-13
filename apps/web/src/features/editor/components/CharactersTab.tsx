import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { showUnknownErrorToast } from '@/lib/show-error-toast';
import { useDeleteCharacter, type EditorCharacterResponse } from '@/features/editor/api';
import { CharacterAssignPanel } from './design/CharacterAssignPanel';
import { CharacterForm } from './CharacterForm';
import type { EditorThemeResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CharactersTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// CharactersTab
// ---------------------------------------------------------------------------

export function CharactersTab({ themeId, theme }: CharactersTabProps) {
  const deleteCharacter = useDeleteCharacter(themeId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<EditorCharacterResponse | undefined>(undefined);
  const [deletingCharacter, setDeletingCharacter] = useState<EditorCharacterResponse | undefined>(undefined);

  function handleCreate() {
    setEditingCharacter(undefined);
    setIsFormOpen(true);
  }

  function handleEdit(character: EditorCharacterResponse) {
    setEditingCharacter(character);
    setIsFormOpen(true);
  }

  function handleFormClose() {
    setIsFormOpen(false);
    setEditingCharacter(undefined);
  }

  function handleDeleteConfirm() {
    if (!deletingCharacter) return;
    deleteCharacter.mutate(deletingCharacter.id, {
      onSuccess: () => {
        toast.success('캐릭터가 삭제되었습니다');
        setDeletingCharacter(undefined);
      },
      onError: (err) => {
        showUnknownErrorToast(err, '캐릭터 삭제에 실패했습니다');
        setDeletingCharacter(undefined);
      },
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CharacterAssignPanel
          themeId={themeId}
          theme={theme}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={setDeletingCharacter}
        />
      </div>

      <CharacterForm
        themeId={themeId}
        character={editingCharacter}
        isOpen={isFormOpen}
        onClose={handleFormClose}
      />

      <Modal
        isOpen={!!deletingCharacter}
        onClose={() => setDeletingCharacter(undefined)}
        title="캐릭터 삭제"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeletingCharacter(undefined)}
              disabled={deleteCharacter.isPending}
            >
              취소
            </Button>
            <Button
              variant="danger"
              isLoading={deleteCharacter.isPending}
              onClick={handleDeleteConfirm}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{deletingCharacter?.name}</span> 캐릭터를
          삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>
    </div>
  );
}
