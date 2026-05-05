import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Save, Trash2, Zap } from 'lucide-react';
import { ActionListEditor } from '@/features/editor/components/design/ActionListEditor';
import type { PhaseAction } from '@/features/editor/flowTypes';
import type { EditorConfig } from '@/features/editor/utils/configShape';
import {
  readTriggersForPlacement,
  writeTriggersForPlacement,
  type EventProgressionTriggerConfig,
  type TriggerPlacementKind,
} from '@/features/editor/utils/eventProgressionConfig';

interface EntityTriggerPlacementCardProps {
  themeId?: string;
  entityKind: TriggerPlacementKind;
  entityId: string;
  entityName: string;
  configJson: EditorConfig | null | undefined;
  onConfigChange?: (nextConfig: EditorConfig) => void;
  isSaving?: boolean;
}

function createTrigger(
  entityKind: TriggerPlacementKind,
  entityId: string
): EventProgressionTriggerConfig {
  const id = `trigger-${entityKind}-${entityId}-${crypto.randomUUID()}`;
  return {
    id,
    label: '',
    actions: [],
    placement: { kind: entityKind, entityId },
  };
}

function isTriggerValid(trigger: EventProgressionTriggerConfig) {
  return (trigger.actions ?? []).some((action) => action.type.trim().length > 0);
}

export function EntityTriggerPlacementCard({
  themeId,
  entityKind,
  entityId,
  entityName,
  configJson,
  onConfigChange,
  isSaving = false,
}: EntityTriggerPlacementCardProps) {
  const placement = useMemo(() => ({ kind: entityKind, entityId }), [entityKind, entityId]);
  const savedTriggers = useMemo(
    () => readTriggersForPlacement(configJson, placement),
    [configJson, placement]
  );
  const [drafts, setDrafts] = useState<EventProgressionTriggerConfig[]>(savedTriggers);

  useEffect(() => {
    setDrafts(savedTriggers);
  }, [savedTriggers]);

  const title = entityKind === 'clue' ? '단서 트리거' : '장소 트리거';
  const description =
    entityKind === 'clue'
      ? '플레이어가 이 단서를 확인하거나 입력을 통과했을 때 실행할 제작 규칙입니다.'
      : '플레이어가 이 장소에 도달하거나 장소 단서를 발견했을 때 실행할 제작 규칙입니다.';
  const canSave = !!onConfigChange && !isSaving && drafts.every(isTriggerValid);

  function updateDraft(index: number, patch: Partial<EventProgressionTriggerConfig>) {
    setDrafts((current) =>
      current.map((trigger, i) => (i === index ? { ...trigger, ...patch } : trigger))
    );
  }

  function handleAdd() {
    setDrafts((current) => [...current, createTrigger(entityKind, entityId)]);
  }

  function handleRemove(index: number) {
    setDrafts((current) => current.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!canSave) return;
    onConfigChange?.(writeTriggersForPlacement(configJson, placement, drafts));
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            진행 연결
          </p>
          <h4 className="mt-1 text-lg font-bold text-slate-100">{title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
          >
            <Plus className="h-4 w-4" />
            트리거 추가
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '저장 중' : '트리거 저장'}
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
          아직 {entityName}에 연결된 트리거가 없습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {drafts.map((trigger, index) => (
            <TriggerDraftRow
              key={trigger.id}
              trigger={trigger}
              index={index}
              title={title}
              themeId={themeId}
              onChange={(patch) => updateDraft(index, patch)}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TriggerDraftRow({
  trigger,
  index,
  title,
  themeId,
  onChange,
  onRemove,
}: {
  trigger: EventProgressionTriggerConfig;
  index: number;
  title: string;
  themeId?: string;
  onChange: (patch: Partial<EventProgressionTriggerConfig>) => void;
  onRemove: () => void;
}) {
  const actions = trigger.actions ?? [];

  function handleActionChange(nextActions: PhaseAction[]) {
    onChange({ actions: nextActions });
  }

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Zap className="h-4 w-4 text-amber-400" />
          {title} {index + 1}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${title} ${index + 1} 삭제`}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <label className="mt-3 block text-xs font-semibold text-slate-400">
        화면 이름
        <input
          type="text"
          value={trigger.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="예: 금고 암호 확인"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
      </label>

      <label className="mt-3 block text-xs font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-amber-400" />
          비밀번호
        </span>
        <input
          type="text"
          value={trigger.password ?? ''}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder="비워두면 즉시 실행"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
      </label>

      <div className="mt-3">
        <ActionListEditor
          label={`${title} ${index + 1}`}
          actions={actions}
          onChange={handleActionChange}
          themeId={themeId}
        />
      </div>

      {!isTriggerValid(trigger) && (
        <p className="mt-2 text-xs text-amber-300">저장하려면 실행 결과를 하나 이상 추가하세요.</p>
      )}
    </article>
  );
}
