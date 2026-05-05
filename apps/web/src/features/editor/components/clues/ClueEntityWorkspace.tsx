import { useMemo, useState } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import type {
  ClueResponse,
  EditorCharacterResponse,
  LocationResponse,
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
  toClueEditorViewModel,
} from '@/features/editor/entities/clue/clueEntityAdapter';
import { EntityTriggerPlacementCard } from '@/features/editor/components/triggers/EntityTriggerPlacementCard';
import { ClueRuntimeEffectCard } from './ClueRuntimeEffectCard';

interface ClueEntityWorkspaceProps {
  themeId?: string;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  locations: LocationResponse[];
  characters: EditorCharacterResponse[];
  onCreate: () => void;
  onEdit: (clue: ClueResponse) => void;
  onDelete: (clue: ClueResponse) => void;
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
  onEdit,
  onDelete,
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
          <ClueDetailCard clue={clue} onEdit={onEdit} onDelete={onDelete} />
          <ClueRuntimeEffectCard
            clue={clue}
            clues={clues}
            configJson={configJson}
            onConfigChange={onConfigChange}
            isSaving={isConfigSaving}
          />
          <EntityTriggerPlacementCard
            themeId={themeId}
            entityKind="clue"
            entityId={clue.id}
            entityName={clue.name}
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
function ClueDetailCard({
  clue,
  onEdit,
  onDelete,
}: {
  clue: ClueResponse;
  onEdit: (clue: ClueResponse) => void;
  onDelete: (clue: ClueResponse) => void;
}) {
  const view = toClueEditorViewModel(clue);

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            단서 상세
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-100">{clue.name}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
            {view.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onEdit(clue)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
          >
            <Edit3 className="h-3.5 w-3.5" />
            수정
          </button>
          <button
            type="button"
            onClick={() => onDelete(clue)}
            aria-label={`${clue.name} 삭제`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoBlock title="공개 범위" value={view.publicScopeLabel} />
        <InfoBlock title="등장 라운드" value={view.roundLabel} />
        <InfoBlock title="사용 효과" value={view.useEffectLabel} />
        <InfoBlock title="사용 후 처리" value={view.consumeLabel} />
      </div>
    </article>
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

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
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
