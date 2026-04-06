import { Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_COUNT = 8;
const PRESETS = Array.from(
  { length: PRESET_COUNT },
  (_, i) => `/avatars/preset-${i + 1}.webp`,
);

// ---------------------------------------------------------------------------
// AvatarPresetGrid
// ---------------------------------------------------------------------------

interface AvatarPresetGridProps {
  selectedUrl: string | null;
  onSelect: (url: string) => void;
}

export function AvatarPresetGrid({
  selectedUrl,
  onSelect,
}: AvatarPresetGridProps) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-3">
      {PRESETS.map((url) => {
        const isSelected = selectedUrl === url;
        return (
          <button
            key={url}
            type="button"
            onClick={() => onSelect(url)}
            className={`relative overflow-hidden rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
              isSelected
                ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900"
                : "opacity-70 hover:opacity-100"
            }`}
            aria-label={`프리셋 아바타 ${url}`}
            aria-pressed={isSelected}
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Check className="h-5 w-5 text-amber-400" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
