import { useState } from 'react';
import { List, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { useDeleteCharacter, type EditorCharacterResponse } from '@/features/editor/api';
import { CharacterListTab } from './CharacterListTab';
import { CharacterAssignPanel } from './design/CharacterAssignPanel';
import { CharacterForm } from './CharacterForm';
import type { EditorThemeResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubTab = 'workspace' | 'list';

interface CharactersTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'workspace', label: '제작', icon: UserCheck },
  { key: 'list', label: '빠른 목록', icon: List },
];

// ---------------------------------------------------------------------------
// CharactersTab
// ---------------------------------------------------------------------------

export function CharactersTab({ themeId, theme }: CharactersTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('workspace');
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
        toast.error(err.message || '캐릭터 삭제에 실패했습니다');
        setDeletingCharacter(undefined);
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── SubTab Navigation ── */}
      <nav className="flex shrink-0 border-b border-slate-800 bg-slate-950 px-2">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSubTab === key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {/* ── SubTab Content ── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {activeSubTab === 'workspace' && (
          <CharacterAssignPanel
            themeId={themeId}
            theme={theme}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={setDeletingCharacter}
          />
        )}
        {activeSubTab === 'list' && <CharacterListTab themeId={themeId} />}
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
