import type { PhaseAction } from "../../flowTypes";
import { OptionList, type OptionItem } from "./InformationDeliveryOptionList";

const ALL_PLAYERS_TARGET_ID = "__all_players__";

interface CharacterOption extends OptionItem {
  id: string;
  name: string;
}

export function BroadcastActionFields({
  action,
  label,
  index,
  characters,
  onParamsChange,
}: {
  action: PhaseAction;
  label: string;
  index: number;
  characters: CharacterOption[];
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  if (action.type !== "BROADCAST_MESSAGE") return null;

  const params = action.params ?? {};
  const message = typeof params.message === "string" ? params.message : "";
  const selectedTargetId = readTargetId(params.target);
  const targetOptions: CharacterOption[] = [
    { id: ALL_PLAYERS_TARGET_ID, name: "전체 캐릭터", summary: "모든 플레이어에게 알림" },
    ...characters,
  ];

  const handleTargetChange = (targetId: string) => {
    onParamsChange({
      ...params,
      target:
        targetId === ALL_PLAYERS_TARGET_ID
          ? { type: "all_players" }
          : { type: "character", character_id: targetId },
    });
  };

  return (
    <div className="grid gap-2">
      <OptionList
        title="알림 대상"
        emptyText="캐릭터가 없습니다."
        items={targetOptions}
        selectedIds={[selectedTargetId]}
        getMeta={() => undefined}
        onToggle={handleTargetChange}
        single
      />
      <label className="block rounded border border-slate-800 bg-slate-950/80 p-2 text-[11px] font-medium text-slate-400">
        플레이어에게 보여줄 알림 문구
        <textarea
          value={message}
          onChange={(e) => onParamsChange({ ...params, message: e.target.value })}
          aria-label={`${label} ${index + 1} 알림 문구`}
          placeholder="예: 금고가 열리며 오래된 편지가 공개됩니다."
          rows={2}
          className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
      </label>
    </div>
  );
}

function readTargetId(target: unknown): string {
  if (!target || typeof target !== "object") return ALL_PLAYERS_TARGET_ID;
  const raw = target as { type?: unknown; character_id?: unknown; characterId?: unknown };
  if (raw.type === "character") {
    const characterId =
      typeof raw.character_id === "string"
        ? raw.character_id
        : typeof raw.characterId === "string"
          ? raw.characterId
          : "";
    return characterId || ALL_PLAYERS_TARGET_ID;
  }
  return ALL_PLAYERS_TARGET_ID;
}
