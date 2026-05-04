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
  triggers?: SelectOption[];
  tokens?: SelectOption[];
  scenes?: SelectOption[];
  rooms?: SelectOption[];
  locations?: SelectOption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const selectCls =
  "rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950";

const targetFieldByVariable: Partial<Record<ConditionRule["variable"], keyof ConditionRule>> = {
  trigger_count: "target_trigger_id",
  investigation_token: "target_token_id",
  scene_visit_count: "target_scene_id",
  room_state: "target_room_id",
  location_state: "target_location_id",
  custom_flag: "target_flag_key",
};

const targetOptionsByKind = {
  trigger: "triggers",
  token: "tokens",
  scene: "scenes",
  room: "rooms",
  location: "locations",
} as const;

function resetTargets(variable: ConditionRule["variable"]): Partial<ConditionRule> {
  return {
    variable,
    target_character_id: undefined,
    target_mission_id: undefined,
    target_clue_id: undefined,
    target_trigger_id: undefined,
    target_token_id: undefined,
    target_scene_id: undefined,
    target_room_id: undefined,
    target_location_id: undefined,
    target_flag_key: undefined,
    value: "",
  };
}

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
  triggers = [],
  tokens = [],
  scenes = [],
  rooms = [],
  locations = [],
}: ConditionRuleProps) {
  const meta = CONDITION_VARIABLES.find((v) => v.value === rule.variable);
  const optionSets = { triggers, tokens, scenes, rooms, locations };

  const update = (patch: Partial<ConditionRule>) =>
    onChange({ ...rule, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-slate-800/60 px-3 py-2">
      {/* Variable */}
      <select
        className={selectCls}
        value={rule.variable}
        onChange={(e) =>
          update(resetTargets(e.target.value as ConditionRule["variable"]))
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

      {meta?.targetLabel && meta.targetKind === "flag" && targetFieldByVariable[rule.variable] && (
        <input
          className={`${selectCls} w-32`}
          value={String(rule[targetFieldByVariable[rule.variable]!] ?? "")}
          onChange={(e) => update({ [targetFieldByVariable[rule.variable]!]: e.target.value })}
          placeholder={meta.targetLabel}
          aria-label={meta.targetLabel}
        />
      )}

      {meta?.targetLabel && meta.targetKind && meta.targetKind !== "flag" && targetFieldByVariable[rule.variable] && (
        <select
          className={selectCls}
          value={String(rule[targetFieldByVariable[rule.variable]!] ?? "")}
          onChange={(e) => update({ [targetFieldByVariable[rule.variable]!]: e.target.value })}
          aria-label={meta.targetLabel}
        >
          <option value="">{meta.targetLabel} 선택</option>
          {optionSets[targetOptionsByKind[meta.targetKind]].map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
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
      {meta?.valueSelect === "boolean" ? (
        <select
          className={selectCls}
          value={rule.value}
          onChange={(e) => update({ value: e.target.value })}
          aria-label={meta.valueLabel}
        >
          <option value="">값 선택</option>
          <option value="true">예</option>
          <option value="false">아니오</option>
        </select>
      ) : meta?.valueSelect === "character" ? (
        <select
          className={selectCls}
          value={rule.value}
          onChange={(e) => update({ value: e.target.value })}
          aria-label={meta.valueLabel}
        >
          <option value="">캐릭터 선택</option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={`${selectCls} w-24`}
          value={rule.value}
          onChange={(e) => update({ value: e.target.value })}
          placeholder={meta?.valueLabel ?? "값"}
          aria-label={meta?.valueLabel ?? "값"}
        />
      )}

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
