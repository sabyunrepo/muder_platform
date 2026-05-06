import { useState } from "react";
import {
  Image as ImageIcon,
  Mic,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import type { ReadingLineDTO } from "../../readingApi";
import { MediaPicker } from "../media/MediaPicker";
import type { MediaResponse, MediaType } from "../../mediaApi";
import { computeSmartAdvanceBy } from "./advanceByDefaults";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingLineRowProps {
  themeId: string;
  line: ReadingLineDTO;
  index: number;
  characters: Array<{ id: string; name: string }>;
  selectedImage?: MediaResponse | null;
  onChange: (line: ReadingLineDTO) => void;
  onDelete: () => void;
}

interface MediaSlotPickerProps {
  themeId: string;
  label: string;
  labelClassName?: string;
  emptyLabel: string;
  removeLabel: string;
  pickerTitle: string;
  filterType: MediaType;
  selectedId?: string;
  selectedLabel: string;
  selectedMedia?: MediaResponse | null;
  icon: LucideIcon;
  selectedClassName: string;
  onSelect: (media: MediaResponse) => void;
  onClear: () => void;
}

function MediaSlotPicker({
  themeId,
  label,
  labelClassName = "",
  emptyLabel,
  removeLabel,
  pickerTitle,
  filterType,
  selectedId,
  selectedLabel,
  selectedMedia,
  icon: Icon,
  selectedClassName,
  onSelect,
  onClear,
}: MediaSlotPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <label className={`text-xs text-slate-400 ${labelClassName}`}>{label}:</label>
      {selectedId ? (
        <span className={`flex items-center gap-1 text-xs ${selectedClassName}`}>
          <Icon className="h-3 w-3" />
          {selectedMedia?.name ?? selectedLabel}
          <button
            type="button"
            onClick={onClear}
            aria-label={removeLabel}
            className="ml-0.5 hover:text-slate-100"
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
          {emptyLabel}
        </button>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onSelect}
        themeId={themeId}
        filterType={filterType}
        selectedId={selectedId}
        title={pickerTitle}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ReadingLineRow
// ---------------------------------------------------------------------------

export function ReadingLineRow({
  themeId,
  line,
  index,
  characters,
  selectedImage,
  onChange,
  onDelete,
}: ReadingLineRowProps) {
  const isNarration = line.Speaker === "나레이션";
  const advanceBy = line.AdvanceBy ?? "";
  const isRoleAdvance = advanceBy.startsWith("role:");
  // The role token stored inside advanceBy is the canonical character id
  // (matches the engine's permission resolver which returns role IDs, never
  // display names). The <select> below therefore uses character.id as the
  // option value and resolves to display name only for rendering.
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
        characters,
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
        characters,
      ) as ReadingLineDTO["AdvanceBy"];
    }
    onChange(next);
  }

  function handleImageSelect(media: MediaResponse) {
    onChange({ ...line, ImageMediaID: media.id });
  }

  function handleImageClear() {
    onChange({ ...line, ImageMediaID: "" });
  }

  function handleAdvanceModeChange(val: string) {
    if (val === "role") {
      const first = characters[0];
      onChange({
        ...line,
        AdvanceBy: first ? (`role:${first.id}` as const) : "",
      });
      return;
    }
    onChange({ ...line, AdvanceBy: val as ReadingLineDTO["AdvanceBy"] });
  }

  function handleRoleSelect(id: string) {
    onChange({ ...line, AdvanceBy: `role:${id}` as const });
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
        <MediaSlotPicker
          themeId={themeId}
          label="음성"
          emptyLabel="음성 추가"
          removeLabel="음성 제거"
          pickerTitle="음성 선택"
          filterType="VOICE"
          selectedId={line.VoiceMediaID}
          selectedLabel="설정됨"
          icon={Mic}
          selectedClassName="text-amber-300"
          onSelect={handleVoiceSelect}
          onClear={handleVoiceClear}
        />

        <MediaSlotPicker
          themeId={themeId}
          label="이미지"
          labelClassName="ml-4"
          emptyLabel="이미지 추가"
          removeLabel="이미지 제거"
          pickerTitle="이미지 선택"
          filterType="IMAGE"
          selectedId={line.ImageMediaID}
          selectedLabel="선택됨"
          selectedMedia={selectedImage}
          icon={ImageIcon}
          selectedClassName="text-sky-300"
          onSelect={handleImageSelect}
          onClear={handleImageClear}
        />

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
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

    </div>
  );
}
