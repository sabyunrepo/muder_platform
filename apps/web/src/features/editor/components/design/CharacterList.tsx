import { User } from "lucide-react";
import type { MysteryRole } from "@/features/editor/api";

const mysteryRoleLabels: Record<MysteryRole, string> = {
  suspect: "용의자",
  culprit: "범인",
  accomplice: "공범",
  detective: "탐정",
};

interface CharacterListItem {
  id: string;
  name: string;
  is_culprit?: boolean;
  mystery_role?: MysteryRole;
}

interface CharacterListProps {
  characters: CharacterListItem[];
  selectedCharId: string | null;
  onSelect: (id: string) => void;
}

export function CharacterList({
  characters,
  selectedCharId,
  onSelect,
}: CharacterListProps) {
  return (
    <aside className="shrink-0 overflow-y-auto border-b border-slate-800 py-2 md:w-60 md:border-b-0 md:border-r">
      {characters.map((char) => (
        <button
          key={char.id}
          type="button"
          onClick={() => onSelect(char.id)}
          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors ${
            selectedCharId === char.id
              ? "bg-slate-800 text-amber-400"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          }`}
        >
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{char.name}</span>
          {(char.mystery_role || char.is_culprit) && (
            <span className="ml-auto shrink-0 text-[10px] text-amber-400">
              {char.mystery_role ? mysteryRoleLabels[char.mystery_role] : "범인"}
            </span>
          )}
        </button>
      ))}
    </aside>
  );
}
