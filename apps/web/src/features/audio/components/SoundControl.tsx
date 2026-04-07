import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, Music, Mic } from "lucide-react";

import {
  useAudioStore,
  selectIsMuted,
  selectMasterVolume,
  selectSfxVolume,
  selectVoiceVolume,
} from "@/stores/audioStore";

// ---------------------------------------------------------------------------
// VolumeSlider
// ---------------------------------------------------------------------------

interface VolumeSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function VolumeSlider({ label, icon, value, onChange, disabled }: VolumeSliderProps) {
  const pct = Math.round(value * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">
        {icon}
      </span>
      <span className="w-12 shrink-0 text-xs text-slate-300">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label={`${label} 볼륨`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="audio-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md
          [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-amber-500
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full"
        style={{
          background: disabled
            ? undefined
            : `linear-gradient(to right, rgb(245 158 11) ${pct}%, rgb(51 65 85) ${pct}%)`,
        }}
      />
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-400">
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SoundControl
// ---------------------------------------------------------------------------

export function SoundControl() {
  const isMuted = useAudioStore(selectIsMuted);
  const masterVolume = useAudioStore(selectMasterVolume);
  const sfxVolume = useAudioStore(selectSfxVolume);
  const voiceVolume = useAudioStore(selectVoiceVolume);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const setSfxVolume = useAudioStore((s) => s.setSfxVolume);
  const setVoiceVolume = useAudioStore((s) => s.setVoiceVolume);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleMuteClick = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  const Icon = isMuted ? VolumeX : Volume2;

  return (
    <div ref={containerRef} className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        onDoubleClick={handleMuteClick}
        aria-label={isMuted ? "사운드 켜기" : "사운드 설정"}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
      >
        <Icon className="h-4 w-4" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-lg">
          {/* Mute toggle */}
          <button
            type="button"
            onClick={handleMuteClick}
            className="mb-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-amber-500" />
            )}
            {isMuted ? "음소거 해제" : "음소거"}
          </button>

          <div className="space-y-3">
            <VolumeSlider
              label="마스터"
              icon={<Volume2 className="h-3.5 w-3.5" />}
              value={masterVolume}
              onChange={setMasterVolume}
              disabled={isMuted}
            />
            <VolumeSlider
              label="음성"
              icon={<Mic className="h-3.5 w-3.5" />}
              value={voiceVolume}
              onChange={setVoiceVolume}
              disabled={isMuted}
            />
            <VolumeSlider
              label="효과음"
              icon={<Music className="h-3.5 w-3.5" />}
              value={sfxVolume}
              onChange={setSfxVolume}
              disabled={isMuted}
            />
          </div>
        </div>
      )}
    </div>
  );
}
