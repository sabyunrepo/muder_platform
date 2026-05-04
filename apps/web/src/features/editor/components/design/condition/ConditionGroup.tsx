import { Plus, PlusSquare, Trash2 } from "lucide-react";
import type { ConditionRule, ConditionGroup } from "./conditionTypes";
import { isGroup, createEmptyRule, createEmptyGroup } from "./conditionTypes";
import { ConditionRuleRow } from "./ConditionRule";
import type { SelectOption } from "./ConditionRule";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionGroupProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  onDelete?: () => void;
  depth?: number;
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

const MAX_DEPTH = 3;

function operatorCls(active: boolean) {
  return active
    ? "rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-500 text-slate-900"
    : "rounded px-2 py-0.5 text-[10px] font-semibold bg-slate-700 text-slate-400 hover:bg-slate-600";
}

// ---------------------------------------------------------------------------
// ConditionGroupBlock
// ---------------------------------------------------------------------------

export function ConditionGroupBlock({
  group,
  onChange,
  onDelete,
  depth = 0,
  characters = [],
  missions = [],
  clues = [],
  triggers = [],
  tokens = [],
  scenes = [],
  rooms = [],
  locations = [],
}: ConditionGroupProps) {
  const updateItem = (
    index: number,
    updated: ConditionRule | ConditionGroup,
  ) => {
    const next = group.rules.map((r, i) => (i === index ? updated : r));
    onChange({ ...group, rules: next });
  };

  const deleteItem = (index: number) => {
    const next = group.rules.filter((_, i) => i !== index);
    onChange({ ...group, rules: next });
  };

  const addRule = () => {
    onChange({ ...group, rules: [...group.rules, createEmptyRule()] });
  };

  const addGroup = () => {
    onChange({ ...group, rules: [...group.rules, createEmptyGroup()] });
  };

  const toggleOperator = () => {
    onChange({ ...group, operator: group.operator === "AND" ? "OR" : "AND" });
  };

  return (
    <div
      className={`rounded border ${depth === 0 ? "border-slate-700" : "border-slate-600/60"} bg-slate-900/50 p-3`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleOperator}
          className={operatorCls(group.operator === "AND")}
          aria-label="AND 연산자"
        >
          AND
        </button>
        <button
          type="button"
          onClick={toggleOperator}
          className={operatorCls(group.operator === "OR")}
          aria-label="OR 연산자"
        >
          OR
        </button>
        <span className="ml-1 text-[10px] text-slate-500">
          모든 조건이 {group.operator === "AND" ? "참" : "하나라도 참"}이면 통과
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="그룹 삭제"
            className="ml-auto rounded p-1 text-slate-500 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        {group.rules.map((item, i) =>
          isGroup(item) ? (
            <ConditionGroupBlock
              key={item.id}
              group={item}
              onChange={(updated) => updateItem(i, updated)}
              onDelete={() => deleteItem(i)}
              depth={depth + 1}
              characters={characters}
              missions={missions}
              clues={clues}
              triggers={triggers}
              tokens={tokens}
              scenes={scenes}
              rooms={rooms}
              locations={locations}
            />
          ) : (
            <ConditionRuleRow
              key={item.id}
              rule={item}
              onChange={(updated) => updateItem(i, updated)}
              onDelete={() => deleteItem(i)}
              characters={characters}
              missions={missions}
              clues={clues}
              triggers={triggers}
              tokens={tokens}
              scenes={scenes}
              rooms={rooms}
              locations={locations}
            />
          ),
        )}
      </div>

      {/* Footer buttons */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-amber-400"
        >
          <Plus className="h-3 w-3" />
          규칙 추가
        </button>
        {depth < MAX_DEPTH && (
          <button
            type="button"
            onClick={addGroup}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-violet-400"
          >
            <PlusSquare className="h-3 w-3" />
            그룹 추가
          </button>
        )}
      </div>
    </div>
  );
}
