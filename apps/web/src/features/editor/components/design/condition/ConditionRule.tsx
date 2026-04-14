import { Trash2 } from "lucide-react";
import type { ConditionRule, ConditionComparator } from "./conditionTypes";
import {
  CONDITION_VARIABLES,
  COMPARATOR_LABELS,
} from "./conditionTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectOption {
  id: string;
  name: string;
}

interface ConditionRuleProps {
  rule: ConditionRule;
  onChange: (rule: ConditionRule) => void;
  onDelete: () => void;
  characters?: SelectOption[];
  missions?: SelectOption[];
  clues?: SelectOption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const selectCls =
  "rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:border-amber-500 focus:outline-none";

// ---------------------------------------------------------------------------
// ConditionRuleRow
// ---------------------------------------------------------------------------

export function ConditionRuleRow({
  rule,
  onChange,
  onDelete,
  characters = [],
  missions = [],
  clues = [],
}: ConditionRuleProps) {
  const meta = CONDITION_VARIABLES.find((v) => v.value === rule.variable);

  const update = (patch: Partial<ConditionRule>) =>
    onChange({ ...rule, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-slate-800/60 px-3 py-2">
      {/* Variable */}
      <select
        className={selectCls}
        value={rule.variable}
        onChange={(e) =>
          update({
            variable: e.target.value as ConditionRule["variable"],
            target_character_id: undefined,
            target_mission_id: undefined,
            target_clue_id: undefined,
            value: "",
          })
        }
        aria-label="변수"
      >
        {CONDITION_VARIABLES.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>

      {/* Character select */}
      {meta?.needsCharacter && (
        <select
          className={selectCls}
          value={rule.target_character_id ?? ""}
          onChange={(e) => update({ target_character_id: e.target.value })}
          aria-label="캐릭터"
        >
          <option value="">캐릭터 선택</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* Mission select */}
      {meta?.needsMission && (
        <select
          className={selectCls}
          value={rule.target_mission_id ?? ""}
          onChange={(e) => update({ target_mission_id: e.target.value })}
          aria-label="미션"
        >
          <option value="">미션 선택</option>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      {/* Clue select */}
      {meta?.needsClue && (
        <select
          className={selectCls}
          value={rule.target_clue_id ?? ""}
          onChange={(e) => update({ target_clue_id: e.target.value })}
          aria-label="단서"
        >
          <option value="">단서 선택</option>
          {clues.map((cl) => (
            <option key={cl.id} value={cl.id}>
              {cl.name}
            </option>
          ))}
        </select>
      )}

      {/* Comparator */}
      <select
        className={selectCls}
        value={rule.comparator}
        onChange={(e) =>
          update({ comparator: e.target.value as ConditionComparator })
        }
        aria-label="비교"
      >
        {(Object.keys(COMPARATOR_LABELS) as ConditionComparator[]).map((c) => (
          <option key={c} value={c}>
            {COMPARATOR_LABELS[c]}
          </option>
        ))}
      </select>

      {/* Value */}
      <input
        className={`${selectCls} w-24`}
        value={rule.value}
        onChange={(e) => update({ value: e.target.value })}
        placeholder="값"
        aria-label="값"
      />

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="규칙 삭제"
        className="ml-auto rounded p-1 text-slate-500 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
