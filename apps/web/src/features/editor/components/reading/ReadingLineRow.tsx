import { useState } from "react";
import { Mic, Trash2, X } from "lucide-react";

import type { ReadingLineDTO } from "../../readingApi";
import { MediaPicker } from "../media/MediaPicker";
import type { MediaResponse } from "../../mediaApi";
import { computeSmartAdvanceBy } from "./advanceByDefaults";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingLineRowProps {
  themeId: string;
  line: ReadingLineDTO;
  index: number;
  characters: Array<{ id: string; name: string }>;
  onChange: (line: ReadingLineDTO) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// ReadingLineRow
// ---------------------------------------------------------------------------

export function ReadingLineRow({
  themeId,
  line,
  index,
  characters,
  onChange,
  onDelete,
}: ReadingLineRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const isNarration = line.Speaker === "나레이션";
  const advanceBy = line.AdvanceBy ?? "";
  const isRoleAdvance = advanceBy.startsWith("role:");
  const currentRoleId = isRoleAdvance ? advanceBy.slice("role:".length) : "";

  const advanceMode: "gm" | "voice" | "role" = isRoleAdvance
    ? "role"
    : advanceBy === "voice"
      ? "voice"
      : "gm";

  // -------------------------------------------------------------------------
  // Handlers — every change recomputes a smart default for AdvanceBy when the
  // user has not explicitly set one (empty string), so swapping speaker or
  // adding voice automatically updates progression policy.
  // -------------------------------------------------------------------------

  function handleSpeakerChange(speaker: string) {
    const next: ReadingLineDTO = { ...line, Speaker: speaker };
    if (!line.AdvanceBy) {
      next.AdvanceBy = computeSmartAdvanceBy(
        next,
        speaker === "나레이션",
      ) as ReadingLineDTO["AdvanceBy"];
    }
    onChange(next);
  }

  function handleVoiceSelect(media: MediaResponse) {
    const next: ReadingLineDTO = { ...line, VoiceMediaID: media.id };
    if (!line.AdvanceBy || line.AdvanceBy === "gm") {
      next.AdvanceBy = "voice";
    }
    onChange(next);
  }

  function handleVoiceClear() {
    const next: ReadingLineDTO = { ...line, VoiceMediaID: "" };
    if (line.AdvanceBy === "voice") {
      next.AdvanceBy = computeSmartAdvanceBy(
        next,
        isNarration,
      ) as ReadingLineDTO["AdvanceBy"];
    }
    onChange(next);
  }

  function handleAdvanceModeChange(val: string) {
    if (val === "role") {
      const first = characters[0];
      onChange({
        ...line,
        AdvanceBy: first ? (`role:${first.name}` as const) : "",
      });
      return;
    }
    onChange({ ...line, AdvanceBy: val as ReadingLineDTO["AdvanceBy"] });
  }

  function handleRoleSelect(name: string) {
    onChange({ ...line, AdvanceBy: `role:${name}` as const });
  }

  return (
    <div className="space-y-2 rounded border border-slate-700 bg-slate-900 p-3">
      <div className="flex items-start gap-2">
        <span className="w-6 pt-1 font-mono text-xs text-slate-500">
          {index + 1}
        </span>
        <select
          aria-label="화자"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          value={line.Speaker || ""}
          onChange={(e) => handleSpeakerChange(e.target.value)}
        >
          <option value="">--</option>
          <option value="나레이션">나레이션</option>
          {characters.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <textarea
          aria-label="대사 또는 지문"
          className="flex-1 resize-none rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          rows={2}
          value={line.Text}
          onChange={(e) => onChange({ ...line, Text: e.target.value })}
          placeholder="대사 또는 지문"
        />
        <button
          type="button"
          onClick={onDelete}
          className="text-rose-400 transition-colors hover:text-rose-300"
          aria-label="줄 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="ml-8 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-400">음성:</label>
        {line.VoiceMediaID ? (
          <span className="flex items-center gap-1 text-xs text-amber-300">
            <Mic className="h-3 w-3" />
            설정됨
            <button
              type="button"
              onClick={handleVoiceClear}
              aria-label="음성 제거"
              className="ml-0.5 text-amber-300 hover:text-amber-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            음성 추가
          </button>
        )}

        <label className="ml-4 text-xs text-slate-400">진행:</label>
        <select
          aria-label="진행 방식"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-100"
          value={advanceMode}
          onChange={(e) => handleAdvanceModeChange(e.target.value)}
        >
          <option value="gm">방장 (GM)</option>
          <option value="voice">음성 자동</option>
          <option value="role">역할 지정</option>
        </select>
        {isRoleAdvance && (
          <select
            aria-label="진행 역할"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-100"
            value={currentRoleId}
            onChange={(e) => handleRoleSelect(e.target.value)}
          >
            {characters.length === 0 && <option value="">--</option>}
            {characters.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleVoiceSelect}
        themeId={themeId}
        filterType="VOICE"
        title="음성 선택"
      />
    </div>
  );
}
