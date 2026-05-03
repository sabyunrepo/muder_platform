import { useMemo, useState } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import type { ClueResponse, EditorCharacterResponse, LocationResponse } from '@/features/editor/api';
import type { EditorConfig } from '@/features/editor/utils/configShape';
import { EntityEditorShell } from '@/features/editor/entities/shell/EntityEditorShell';
import { buildClueUsageMap, getClueBacklinks, type EntityReference } from '@/features/editor/utils/entityReferences';
import { formatRoundRange } from '@/features/editor/utils/roundFormat';

interface ClueEntityWorkspaceProps {
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  locations: LocationResponse[];
  characters: EditorCharacterResponse[];
  onCreate: () => void;
  onEdit: (clue: ClueResponse) => void;
  onDelete: (clue: ClueResponse) => void;
}

export function ClueEntityWorkspace({
  clues,
  configJson,
  locations,
  characters,
  onCreate,
  onEdit,
  onDelete,
}: ClueEntityWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(clues[0]?.id ?? '');
  const usageMap = useMemo(
    () => buildClueUsageMap({ configJson, clues, locations, characters }),
    [configJson, clues, locations, characters],
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
      getItemBadges={(clue) => clueBadges(clue, usageMap[clue.id]?.references.length ?? 0)}
      renderDetail={(clue) => <ClueDetailCard clue={clue} onEdit={onEdit} onDelete={onDelete} />}
      renderInspector={(clue) => <ClueUsageCard references={getClueBacklinks(usageMap, clue.id)} />}
    />
  );
}

function clueBadges(clue: ClueResponse, referenceCount: number) {
  return [
    clue.is_common ? '모두에게 공개' : null,
    clue.is_usable ? '사용 가능' : null,
    referenceCount > 0 ? `연결 ${referenceCount}` : '미배치',
  ].filter((badge): badge is string => !!badge);
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
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">단서 상세</p>
          <h3 className="mt-1 text-xl font-bold text-slate-100">{clue.name}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
            {clue.description || '플레이어에게 보일 단서 설명을 입력하세요.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onEdit(clue)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
          >
            <Edit3 className="h-3.5 w-3.5" />수정
          </button>
          <button
            type="button"
            onClick={() => onDelete(clue)}
            aria-label={`${clue.name} 삭제`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />삭제
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoBlock title="공개 범위" value={clue.is_common ? '모든 플레이어가 공유' : '지정된 캐릭터나 장소에서만 획득'} />
        <InfoBlock title="등장 라운드" value={formatRoundRange(clue.reveal_round, clue.hide_round) || '처음부터 끝까지'} />
        <InfoBlock title="사용 효과" value={clue.is_usable ? formatEffectLabel(clue.use_effect) : '사용 효과 없음'} />
        <InfoBlock title="사용 후 처리" value={formatConsumeLabel(clue)} />
      </div>
    </article>
  );
}

function ClueUsageCard({ references }: { references: EntityReference[] }) {
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-slate-200">이 단서가 쓰이는 곳</p>
      <p className="mt-1 text-xs text-slate-500">삭제하거나 수정할 때 함께 확인해야 하는 연결입니다.</p>
      {references.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
          아직 배치된 장소나 시작 단서가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {references.map((ref) => (
            <li key={`${ref.sourceType}-${ref.sourceId}-${ref.relation}`} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
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

function formatEffectLabel(effect?: string | null) {
  if (effect === 'peek') return '다른 플레이어 단서 보기';
  if (effect === 'steal') return '다른 플레이어에게서 단서 가져오기';
  if (effect === 'reveal') return '정보 공개하기';
  if (effect === 'block') return '상대의 사용 막기';
  if (effect === 'swap') return '단서 교환하기';
  return '사용 효과 없음';
}

function formatConsumeLabel(clue: ClueResponse) {
  if (!clue.is_usable) return '해당 없음';
  return clue.use_consumed ? '사용하면 내 단서함에서 사라짐' : '사용 후에도 단서함에 남음';
}

function formatReference(ref: EntityReference) {
  if (ref.relation === 'location_clue') return `${ref.sourceName}의 발견 단서`;
  if (ref.relation === 'evidence') return `${ref.sourceName}의 증거 설정`;
  if (ref.relation === 'starting_clue') return `${ref.sourceName}의 시작 단서`;
  if (ref.relation === 'combination_input') return `${ref.sourceName}의 조합 조건`;
  if (ref.relation === 'combination_output') return `${ref.sourceName}의 조합 보상`;
  return `${ref.sourceName}의 연결 설정`;
}
