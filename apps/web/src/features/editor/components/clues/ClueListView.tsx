import { useState } from 'react';
import { toast } from 'sonner';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import {
  useEditorTheme,
  useEditorCharacters,
  useEditorLocations,
  useEditorClues,
  useDeleteClue,
  useUpdateConfigJson,
  type ClueResponse,
} from '@/features/editor/api';
import type { EditorConfig } from '@/features/editor/utils/configShape';
import { buildClueUsageMap, type EntityReference } from '@/features/editor/utils/entityReferences';
import { ClueForm } from '../ClueForm';
import { ClueEntityWorkspace } from './ClueEntityWorkspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueListViewProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// ClueListView
// ---------------------------------------------------------------------------

export function ClueListView({ themeId }: ClueListViewProps) {
  const { data: clues, isLoading } = useEditorClues(themeId);
  const { data: theme } = useEditorTheme(themeId);
  const { data: locations = [] } = useEditorLocations(themeId);
  const { data: characters = [] } = useEditorCharacters(themeId);
  const deleteClue = useDeleteClue(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
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
      onSuccess: () => { toast.success('단서가 삭제되었습니다'); setDeletingClue(undefined); },
      onError: (err) => { toast.error(err.message || '단서 삭제에 실패했습니다'); setDeletingClue(undefined); },
    });
  }

  function handleConfigChange(nextConfig: EditorConfig) {
    updateConfig.mutate(nextConfig, {
      onSuccess: () => toast.success('단서 사용 효과가 저장되었습니다'),
      onError: () => toast.error('단서 사용 효과 저장에 실패했습니다'),
    });
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>;
  }

  const deletingReferences = deletingClue && clues
    ? buildClueUsageMap({
      configJson: theme?.config_json,
      clues,
      locations,
      characters,
    })[deletingClue.id]?.references ?? []
    : [];

  return (
    <div className="px-4 py-6">
      <ClueEntityWorkspace
        clues={clues ?? []}
        configJson={theme?.config_json}
        locations={locations}
        characters={characters}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={setDeletingClue}
        onConfigChange={handleConfigChange}
        isConfigSaving={updateConfig.isPending}
      />

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
          <span className="font-semibold text-slate-100">{deletingClue?.name}</span> 단서를 삭제하시겠습니까?
          연결된 설정은 함께 정리되어, 없는 단서를 가리키는 문제가 남지 않습니다.
        </p>
        {deletingReferences.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-200">
              함께 정리될 연결 {deletingReferences.length}곳
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-100/80">
              {deletingReferences.map((ref) => (
                <li key={`${ref.sourceType}-${ref.sourceId}-${ref.relation}`}>
                  {formatDeleteReference(ref)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
            현재 연결된 장소나 캐릭터 설정은 없습니다.
          </p>
        )}
      </Modal>
    </div>
  );
}

function formatDeleteReference(ref: EntityReference) {
  if (ref.relation === 'location_clue') return `${ref.sourceName}의 발견 단서에서 제거됩니다.`;
  if (ref.relation === 'evidence') return `${ref.sourceName}의 증거 설정에서 제거됩니다.`;
  if (ref.relation === 'starting_clue') return `${ref.sourceName}의 시작 단서에서 제거됩니다.`;
  if (ref.relation === 'combination_input') return `${ref.sourceName}의 조합 조건에서 제거됩니다.`;
  if (ref.relation === 'combination_output') return `${ref.sourceName}의 조합 보상에서 제거됩니다.`;
  return `${ref.sourceName}의 연결 설정에서 제거됩니다.`;
}
