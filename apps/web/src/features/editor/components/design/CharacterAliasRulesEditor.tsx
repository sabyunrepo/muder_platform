import { useEffect, useState } from 'react';
import type { CharacterAliasRule } from '@/features/editor/api';
import { groupToRecord, type ConditionGroup } from './condition/conditionTypes';
import { normalizeCharacterAliasRules } from '@/features/editor/entities/character/characterEditorAdapter';
import { MediaPicker } from '@/features/editor/components/media/MediaPicker';
import type {
  ProgressNodeRevealOption,
} from '@/features/editor/entities/reveal/revealTimingOptions';

interface CharacterAliasRulesEditorProps {
  themeId: string;
  characterName: string;
  rules: CharacterAliasRule[];
  characterOptions?: unknown;
  roundOptions?: unknown;
  nodeOptions?: ProgressNodeRevealOption[];
  disabled: boolean;
  onChange: (rules: CharacterAliasRule[]) => void;
  onSave: (rules: CharacterAliasRule[]) => void;
}

interface CharacterAliasRuleItemProps {
  themeId: string;
  rule: CharacterAliasRule;
  index: number;
  characterName: string;
  nodeOptions: ProgressNodeRevealOption[];
  disabled: boolean;
  onUpdate: (index: number, patch: Partial<CharacterAliasRule>) => void;
  onRemove: (index: number) => void;
}

export function CharacterAliasRulesEditor({
  themeId,
  characterName,
  rules,
  nodeOptions = DEFAULT_ALIAS_NODE_OPTIONS,
  disabled,
  onChange,
  onSave,
}: CharacterAliasRulesEditorProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValidationError(null);
  }, [rules, characterName]);

  const addRule = () => {
    if (disabled) return;
    setValidationError(null);
    const nodeId = getDefaultAliasNodeId(nodeOptions);
    onChange([
      ...rules,
      {
        id: createAliasRuleID(),
        label: '',
        display_name: '',
        display_icon_url: '',
        display_icon_media_id: '',
        priority: rules.length,
        condition: groupToRecord(createAliasNodeReachedCondition(nodeId)),
      },
    ]);
  };
  const updateRule = (index: number, patch: Partial<CharacterAliasRule>) => {
    if (disabled) return;
    setValidationError(null);
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };
  const removeRule = (index: number) => {
    if (disabled) return;
    setValidationError(null);
    onChange(rules.filter((_, i) => i !== index));
  };
  const handleSave = () => {
    if (disabled) return;
    const invalidRule = rules.find((rule) => !rule.display_name?.trim() && !rule.display_icon_url?.trim() && !rule.display_icon_media_id?.trim());
    if (invalidRule) {
      setValidationError('표시 이름 또는 표시 아이콘을 입력하세요.');
      return;
    }
    setValidationError(null);
    onSave(normalizeCharacterAliasRules(normalizeAliasRulesForNodeReveal(rules, nodeOptions)));
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-200">플레이 중 표시</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            조건을 만족하면 기본 이름과 사진 대신 별칭과 아이콘을 보여줍니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addRule}
          disabled={disabled}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100 disabled:cursor-default disabled:opacity-50"
        >
          규칙 추가
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-center text-xs text-slate-600">
            조건부 표시 규칙이 없습니다.
          </p>
        ) : rules.map((rule, index) => (
          <CharacterAliasRuleItem
            key={rule.id}
            themeId={themeId}
            rule={rule}
            index={index}
            characterName={characterName}
            nodeOptions={nodeOptions}
            disabled={disabled}
            onUpdate={updateRule}
            onRemove={removeRule}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        {validationError ? (
          <p className="mr-auto self-center text-[11px] text-red-300">{validationError}</p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-default disabled:bg-slate-800 disabled:text-slate-500"
        >
          플레이 중 표시 저장
        </button>
      </div>
    </div>
  );
}

function CharacterAliasRuleItem({
  themeId,
  rule,
  index,
  characterName,
  nodeOptions,
  disabled,
  onUpdate,
  onRemove,
}: CharacterAliasRuleItemProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const nodeId = inferAliasNodeId(rule.condition, nodeOptions);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-slate-400">
          규칙 이름
          <input
            value={rule.label ?? ''}
            disabled={disabled}
            onChange={(event) => onUpdate(index, { label: event.currentTarget.value })}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          표시 이름
          <input
            value={rule.display_name ?? ''}
            placeholder={characterName}
            disabled={disabled}
            onChange={(event) => onUpdate(index, { display_name: event.currentTarget.value })}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
          />
        </label>
      </div>
      {rule.display_icon_url && !rule.display_icon_media_id ? (
        <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-4 text-amber-100">
          이전 URL 아이콘이 저장되어 있습니다. 새 아이콘을 선택하면 미디어 관리 이미지로 교체됩니다.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100 disabled:cursor-default disabled:opacity-50"
        >
          미디어에서 아이콘 선택
        </button>
        {rule.display_icon_media_id ? (
          <button
            type="button"
            onClick={() => onUpdate(index, { display_icon_media_id: '' })}
            disabled={disabled}
            className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition hover:bg-red-950/40 hover:text-red-300 disabled:cursor-default disabled:opacity-50"
          >
            선택 해제
          </button>
        ) : null}
        {rule.display_icon_media_id ? (
          <span className="max-w-full truncate text-[11px] text-slate-500">
            미디어 이미지 선택됨
          </span>
        ) : null}
      </div>
      <label className="mt-3 block text-[11px] text-slate-400">
        별칭 전환 장면
        <select
          value={nodeId}
          disabled={disabled}
          onChange={(event) => {
            onUpdate(index, { condition: groupToRecord(createAliasNodeReachedCondition(event.currentTarget.value)) });
          }}
          className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
          aria-label="별칭 전환 장면"
        >
          {nodeOptions.length === 0 ? (
            <option value="">선택할 장면 없음</option>
          ) : null}
          {nodeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={disabled}
          className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition hover:bg-red-950/40 hover:text-red-300"
        >
          삭제
        </button>
      </div>
      {pickerOpen ? (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(media) => {
            onUpdate(index, { display_icon_media_id: media.id, display_icon_url: '' });
            setPickerOpen(false);
          }}
          themeId={themeId}
          useCase="character_alias_icon"
          selectedId={rule.display_icon_media_id ?? null}
          title="표시 아이콘 선택"
        />
      ) : null}
    </div>
  );
}

let aliasRuleIdSeq = 0;

function createAliasRuleID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  aliasRuleIdSeq += 1;
  return `alias-${Date.now()}-${aliasRuleIdSeq}`;
}

const DEFAULT_ALIAS_NODE_OPTIONS = [
  { value: 'intro_finished', label: '자기소개 종료' },
  { value: 'round_summary', label: '라운드 정리' },
  { value: 'voting_started', label: '투표 시작' },
] as const;

function createAliasNodeReachedCondition(nodeId = DEFAULT_ALIAS_NODE_OPTIONS[0].value): ConditionGroup {
  return {
    id: createAliasRuleID(),
    operator: 'AND',
    rules: [{
      id: createAliasRuleID(),
      variable: 'custom_flag',
      target_flag_key: 'story_node_reached',
      comparator: '=',
      value: nodeId,
    }],
  };
}

function inferAliasNodeId(
  raw: CharacterAliasRule['condition'],
  nodeOptions: ProgressNodeRevealOption[] = DEFAULT_ALIAS_NODE_OPTIONS,
): string {
  const fallback = getDefaultAliasNodeId(nodeOptions);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const rules = (raw as { rules?: unknown }).rules;
  if (!Array.isArray(rules) || rules.length !== 1) return fallback;
  const rule = rules[0] as { target_flag_key?: unknown; value?: unknown };
  if (rule.target_flag_key === 'story_node_reached' && typeof rule.value === 'string') {
    return rule.value || fallback;
  }
  return fallback;
}

function getDefaultAliasNodeId(nodeOptions: ProgressNodeRevealOption[] = DEFAULT_ALIAS_NODE_OPTIONS): string {
  return nodeOptions[0]?.value ?? '';
}

function normalizeAliasRulesForNodeReveal(
  rules: CharacterAliasRule[],
  nodeOptions: ProgressNodeRevealOption[] = DEFAULT_ALIAS_NODE_OPTIONS,
): CharacterAliasRule[] {
  return rules.map((rule, index) => {
    const nodeId = inferAliasNodeId(rule.condition, nodeOptions);
    return {
      ...rule,
      priority: index,
      condition: groupToRecord(createAliasNodeReachedCondition(nodeId)),
    };
  });
}
