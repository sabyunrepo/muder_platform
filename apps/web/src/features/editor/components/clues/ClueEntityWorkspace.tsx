import { useMemo, useState } from 'react';
import type {
  ClueResponse,
  EditorCharacterResponse,
  LocationResponse,
  UpdateClueRequest,
} from '@/features/editor/api';
import type { EditorConfig } from '@/features/editor/utils/configShape';
import { EntityEditorShell } from '@/features/editor/entities/shell/EntityEditorShell';
import {
  buildClueUsageMap,
  getClueBacklinks,
  type EntityReference,
} from '@/features/editor/utils/entityReferences';
import {
  buildClueBadges,
} from '@/features/editor/entities/clue/clueEntityAdapter';
import { ClueRuntimeEffectCard } from './ClueRuntimeEffectCard';
import { ClueBasicInfoCard } from './ClueBasicInfoCard';

interface ClueEntityWorkspaceProps {
  themeId?: string;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  locations: LocationResponse[];
  characters: EditorCharacterResponse[];
  onCreate: () => void;
  onUpdate: (clueId: string, body: UpdateClueRequest) => void;
  onDelete: (clue: ClueResponse) => void;
  isClueSaving?: boolean;
  onConfigChange?: (configJson: EditorConfig) => void;
  isConfigSaving?: boolean;
}

export function ClueEntityWorkspace({
  themeId,
  clues,
  configJson,
  locations,
  characters,
  onCreate,
  onUpdate,
  onDelete,
  isClueSaving,
  onConfigChange,
  isConfigSaving,
}: ClueEntityWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(clues[0]?.id ?? '');
  const usageMap = useMemo(
    () => buildClueUsageMap({ configJson, clues, locations, characters }),
    [configJson, clues, locations, characters]
  );

  return (
    <EntityEditorShell
      title="단서"
      items={clues}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onCreate={onCreate}
      getItemId={(clue) => clue.id}
      getItemTitle={(clue) => clue.name}
      getItemDescription={(clue) => clue.description || '설명 없음'}
      getItemBadges={(clue) => buildClueBadges(clue, usageMap[clue.id]?.references.length ?? 0)}
      renderDetail={(clue) => (
        <div className="space-y-4">
          <ClueBasicInfoCard
            themeId={themeId ?? ''}
            clue={clue}
            configJson={configJson}
            isSaving={isClueSaving}
            isConfigSaving={isConfigSaving}
            onSave={onUpdate}
            onConfigChange={onConfigChange}
            onDelete={onDelete}
          />
          <ClueRuntimeEffectCard
            clue={clue}
            clues={clues}
            configJson={configJson}
            onConfigChange={onConfigChange}
            isSaving={isConfigSaving}
          />
        </div>
      )}
      renderInspector={(clue) => <ClueUsageCard references={getClueBacklinks(usageMap, clue.id)} />}
    />
  );
}

function ClueUsageCard({ references }: { references: EntityReference[] }) {
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-slate-200">이 단서가 쓰이는 곳</p>
      <p className="mt-1 text-xs text-slate-500">
        삭제하거나 수정할 때 함께 확인해야 하는 연결입니다.
      </p>
      {references.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
          아직 배치된 장소나 시작 단서가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {references.map((ref, index) => (
            <li
              key={`${ref.sourceType}-${ref.sourceId}-${ref.relation}-${index}`}
              className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"
            >
              {formatReference(ref)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function formatReference(ref: EntityReference) {
  if (ref.relation === 'location_clue') return `${ref.sourceName}의 발견 단서`;
  if (ref.relation === 'evidence') return `${ref.sourceName}의 증거 설정`;
  if (ref.relation === 'starting_clue') return `${ref.sourceName}의 시작 단서`;
  if (ref.relation === 'combination_input') return `${ref.sourceName}의 조합 조건`;
  if (ref.relation === 'combination_output') return `${ref.sourceName}의 조합 보상`;
  if (ref.relation === 'trigger') return `${ref.sourceName}의 트리거`;
  return `${ref.sourceName}의 연결 설정`;
}
