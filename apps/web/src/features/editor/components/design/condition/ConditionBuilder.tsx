import { GitBranch } from "lucide-react";
import type { ConditionGroup } from "./conditionTypes";
import { recordToGroup, groupToRecord, createEmptyGroup } from "./conditionTypes";
import { ConditionGroupBlock } from "./ConditionGroup";
import type { SelectOption } from "./ConditionRule";
import { CONDITION_HELP_TEXT, DEFAULT_CONDITION_LABEL } from "../../../entities/shared/conditionAdapter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionBuilderProps {
  condition: Record<string, unknown> | null;
  onChange: (condition: Record<string, unknown>) => void;
  characters?: SelectOption[];
  missions?: SelectOption[];
  clues?: SelectOption[];
  label?: string;
}

// ---------------------------------------------------------------------------
// ConditionBuilder
// ---------------------------------------------------------------------------

export function ConditionBuilder({
  condition,
  onChange,
  characters = [],
  missions = [],
  clues = [],
  label,
}: ConditionBuilderProps) {
  const group: ConditionGroup = recordToGroup(condition);

  const handleChange = (updated: ConditionGroup) => {
    onChange(groupToRecord(updated));
  };

  const handleClear = () => {
    onChange(groupToRecord(createEmptyGroup()));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-medium text-slate-300">
            {label ?? DEFAULT_CONDITION_LABEL}
          </span>
        </div>
        <p className="sr-only">{CONDITION_HELP_TEXT}</p>
        <button
          type="button"
          onClick={handleClear}
          className="text-[10px] text-slate-500 hover:text-slate-300"
        >
          초기화
        </button>
      </div>

      {/* Root group */}
      <ConditionGroupBlock
        group={group}
        onChange={handleChange}
        depth={0}
        characters={characters}
        missions={missions}
        clues={clues}
      />
    </div>
  );
}
