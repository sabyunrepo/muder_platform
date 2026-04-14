import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import {
  useEditorCharacters,
  useDeleteCharacter,
  type EditorCharacterResponse,
} from '@/features/editor/api';
import { CharacterForm } from './CharacterForm';
import { CharacterCard } from './CharacterCard';

// ---------------------------------------------------------------------------
// CharacterListTab
// ---------------------------------------------------------------------------

interface CharacterListTabProps {
  themeId: string;
}

export function CharacterListTab({ themeId }: CharacterListTabProps) {
  const { data: characters, isLoading } = useEditorCharacters(themeId);
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

  function handleDeleteConfirm() {
    if (!deletingCharacter) return;
    deleteCharacter.mutate(deletingCharacter.id, {
      onSuccess: () => {
        toast.success('캐릭터가 삭제되었습니다');
        setDeletingCharacter(undefined);
      },
      onError: (err) => {
        toast.error(err.message || '캐릭터 삭제에 실패했습니다');
        setDeletingCharacter(undefined);
      },
    });
  }

  function handleFormClose() {
    setIsFormOpen(false);
    setEditingCharacter(undefined);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const isEmpty = !characters || characters.length === 0;

  return (
    <div className="px-4 py-6">
      {isEmpty ? (
        <div className="py-16 text-center">
          <div className="text-4xl font-mono font-bold text-slate-800 mb-2">0</div>
          <div className="text-xs font-mono uppercase tracking-widest text-slate-700 mb-4">
            등장인물 없음
          </div>
          <div className="text-xs text-slate-600 mb-6">최소 2명의 등장인물이 필요합니다</div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            캐릭터 추가
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character, index) => (
            <CharacterCard
              key={character.id}
              character={character}
              index={index}
              onEdit={handleEdit}
              onDelete={setDeletingCharacter}
            />
          ))}

          <button
            type="button"
            onClick={handleCreate}
            className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-slate-800 p-6 text-slate-700 hover:border-slate-600 hover:text-slate-500 transition-colors min-h-[100px]"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">캐릭터 추가</span>
          </button>
        </div>
      )}

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
