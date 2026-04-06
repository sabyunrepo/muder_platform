import { Volume1, Volume2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VolumeSliderProps {
  volume: number;
  onChange: (volume: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VolumeSlider({ volume, onChange }: VolumeSliderProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Volume1 size={14} className="text-slate-400 shrink-0" />
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="
            w-full h-1.5 appearance-none rounded-full cursor-pointer
            bg-slate-700
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-amber-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-amber-500
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
          "
          style={{
            background: `linear-gradient(to right, #f59e0b ${volume * 100}%, #334155 ${volume * 100}%)`,
          }}
        />
      </div>
      <Volume2 size={14} className="text-slate-400 shrink-0" />
    </div>
  );
}
