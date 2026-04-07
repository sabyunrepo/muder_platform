import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, Music, Mic, Sparkles } from "lucide-react";

import {
  useAudioStore,
  selectIsMuted,
  selectMasterVolume,
  selectBgmVolume,
  selectVoiceVolume,
  selectSfxVolume,
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

function VolumeSlider({
  label,
  icon,
  value,
  onChange,
  disabled,
}: VolumeSliderProps) {
  const pct = Math.round(value * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">
        {icon}
      </span>
      <span className="w-14 shrink-0 text-xs text-slate-300">{label}</span>
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
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-400">
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InGameSoundControl
// ---------------------------------------------------------------------------

/**
 * Floating in-game sound control button + popover.
 *
 * Renders a fixed speaker button (top-right) that opens a popover containing
 * 4 volume sliders (Master / BGM / Voice / SFX) plus a mute toggle.
 *
 * Behavior:
 * - Click button to toggle popover
 * - Click outside to close
 * - Press Escape to close
 *
 * Volume changes persist via audioStore (localStorage, see B2).
 * This component does NOT mount itself anywhere — game play page mounting
 * is the responsibility of Phase F.
 */
export function InGameSoundControl() {
  const isMuted = useAudioStore(selectIsMuted);
  const masterVolume = useAudioStore(selectMasterVolume);
  const bgmVolume = useAudioStore(selectBgmVolume);
  const voiceVolume = useAudioStore(selectVoiceVolume);
  const sfxVolume = useAudioStore(selectSfxVolume);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const setBgmVolume = useAudioStore((s) => s.setBgmVolume);
  const setVoiceVolume = useAudioStore((s) => s.setVoiceVolume);
  const setSfxVolume = useAudioStore((s) => s.setSfxVolume);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleMuteClick = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  const Icon = isMuted ? VolumeX : Volume2;

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-40">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isMuted ? "사운드 켜기" : "사운드 설정"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-200 shadow-lg backdrop-blur transition-colors hover:bg-slate-800 hover:text-amber-400"
      >
        <Icon className="h-5 w-5" />
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="사운드 설정"
          aria-modal="false"
          className="absolute top-12 right-0 w-64 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl"
        >
          <h3 className="mb-3 text-sm font-medium text-slate-200">
            사운드 설정
          </h3>

          <div className="space-y-3">
            <VolumeSlider
              label="마스터"
              icon={<Volume2 className="h-3.5 w-3.5" />}
              value={masterVolume}
              onChange={setMasterVolume}
              disabled={isMuted}
            />
            <VolumeSlider
              label="배경음악"
              icon={<Music className="h-3.5 w-3.5" />}
              value={bgmVolume}
              onChange={setBgmVolume}
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
              icon={<Sparkles className="h-3.5 w-3.5" />}
              value={sfxVolume}
              onChange={setSfxVolume}
              disabled={isMuted}
            />
          </div>

          <button
            type="button"
            onClick={handleMuteClick}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700"
          >
            {isMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5 text-red-400" />
                음소거 해제
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-amber-500" />
                음소거
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
