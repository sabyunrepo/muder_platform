import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Modal } from '@/shared/components/ui/Modal';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Spinner } from '@/shared/components/ui/Spinner';
import {
  useEditorCharacters,
  useDeleteCharacter,
  type EditorCharacterResponse,
} from '@/features/editor/api';
import { CharacterForm } from './CharacterForm';

interface CharactersTabProps {
  themeId: string;
  theme?: unknown;
}

export function CharactersTab({ themeId }: CharactersTabProps) {
  const { data: characters, isLoading } = useEditorCharacters(themeId);
  const deleteCharacter = useDeleteCharacter(themeId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<EditorCharacterResponse | undefined>(
    undefined,
  );
  const [deletingCharacter, setDeletingCharacter] = useState<EditorCharacterResponse | undefined>(
    undefined,
  );

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">캐릭터 목록</h3>
        <Button size="sm" onClick={handleCreate}>
          캐릭터 추가
        </Button>
      </div>

      {!characters || characters.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="등록된 캐릭터가 없습니다"
          description="캐릭터를 추가하여 테마를 구성하세요"
          action={
            <Button size="sm" onClick={handleCreate}>
              캐릭터 추가
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {characters.map((character) => (
            <div
              key={character.id}
              className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{character.name}</span>
                  {character.is_culprit && (
                    <Badge variant="danger" size="sm">
                      범인
                    </Badge>
                  )}
                  <Badge variant="default" size="sm">
                    #{character.sort_order}
                  </Badge>
                </div>
                {character.description && (
                  <p className="mt-0.5 truncate text-sm text-slate-400">
                    {character.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(character)}
                  aria-label={`${character.name} 수정`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingCharacter(character)}
                  aria-label={`${character.name} 삭제`}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
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
