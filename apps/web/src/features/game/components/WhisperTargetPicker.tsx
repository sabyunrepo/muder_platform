import { UserCheck } from "lucide-react";
import type { Player } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhisperTargetPickerProps {
  players: Player[];
  selected: string;
  onSelect: (playerId: string) => void;
}

// ---------------------------------------------------------------------------
// WhisperTargetPicker
// ---------------------------------------------------------------------------

/**
 * Dropdown to pick a whisper target from the player list.
 */
export function WhisperTargetPicker({
  players,
  selected,
  onSelect,
}: WhisperTargetPickerProps) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
      <UserCheck className="h-4 w-4 shrink-0 text-purple-400" />
      <select
        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="귓속말 대상 선택"
      >
        <option value="">대상 선택...</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nickname}
          </option>
        ))}
      </select>
    </div>
  );
}
