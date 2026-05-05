import { useState } from 'react';
import type { CharacterAliasRule } from '@/features/editor/api';
import type { SelectOption } from './condition/ConditionRule';
import { ConditionBuilder } from './condition/ConditionBuilder';
import { groupToRecord, type ConditionGroup } from './condition/conditionTypes';
import { normalizeCharacterAliasRules } from '@/features/editor/entities/character/characterEditorAdapter';

interface CharacterAliasRulesEditorProps {
  characterName: string;
  characterImageUrl?: string | null;
  rules: CharacterAliasRule[];
  characterOptions: SelectOption[];
  disabled: boolean;
  onChange: (rules: CharacterAliasRule[]) => void;
  onSave: (rules: CharacterAliasRule[]) => void;
}

export function CharacterAliasRulesEditor({
  characterName,
  characterImageUrl,
  rules,
  characterOptions,
  disabled,
  onChange,
  onSave,
}: CharacterAliasRulesEditorProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const addRule = () => {
    if (disabled) return;
    setValidationError(null);
    onChange([
      ...rules,
      {
        id: createAliasRuleID(),
        label: '',
        display_name: '',
        display_icon_url: '',
        priority: rules.length,
        condition: groupToRecord(createDefaultAliasCondition()),
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
    const invalidRule = rules.find((rule) => !rule.display_name?.trim() && !rule.display_icon_url?.trim());
    if (invalidRule) {
      setValidationError('표시 이름 또는 표시 아이콘 URL을 입력하세요.');
      return;
    }
    setValidationError(null);
    onSave(normalizeCharacterAliasRules(rules));
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
          <div key={rule.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem]">
              <label className="text-[11px] text-slate-400">
                규칙 이름
                <input
                  value={rule.label ?? ''}
                  disabled={disabled}
                  onChange={(event) => updateRule(index, { label: event.currentTarget.value })}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                표시 이름
                <input
                  value={rule.display_name ?? ''}
                  placeholder={characterName}
                  disabled={disabled}
                  onChange={(event) => updateRule(index, { display_name: event.currentTarget.value })}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                우선순위
                <input
                  type="number"
                  min={0}
                  value={rule.priority}
                  disabled={disabled}
                  onChange={(event) => updateRule(index, { priority: Number(event.currentTarget.value) || 0 })}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
                />
              </label>
            </div>
            <label className="mt-2 block text-[11px] text-slate-400">
              표시 아이콘 URL
              <input
                value={rule.display_icon_url ?? ''}
                placeholder={characterImageUrl ?? 'https://...'}
                disabled={disabled}
                onChange={(event) => updateRule(index, { display_icon_url: event.currentTarget.value })}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
              />
            </label>
            <div className="mt-3">
              <ConditionBuilder
                label="표시 조건"
                condition={rule.condition}
                onChange={(condition) => updateRule(index, { condition })}
                characters={characterOptions}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeRule(index)}
                disabled={disabled}
                className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition hover:bg-red-950/40 hover:text-red-300"
              >
                삭제
              </button>
            </div>
          </div>
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

function createAliasRuleID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `alias-${Date.now()}`;
}

function createDefaultAliasCondition(): ConditionGroup {
  return {
    id: createAliasRuleID(),
    operator: 'AND',
    rules: [{
      id: createAliasRuleID(),
      variable: 'custom_flag',
      target_flag_key: 'alias_ready',
      comparator: '=',
      value: 'true',
    }],
  };
}
