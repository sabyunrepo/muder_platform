import type { ReadingSectionResponse } from "../../readingApi";

export interface ReadingSectionPickerOption {
  id: string;
  name: string;
  summary: string;
  metaLabel: string;
  groupLabel: string;
}

const EMPTY_SUMMARY = "아직 작성된 내용이 없습니다.";
type ReadingLineView = Pick<ReadingSectionResponse["lines"][number], "Text" | "Speaker">;

/**
 * Frontend Adapter for creator-facing story information.
 *
 * Current backend stores reading sections as text lines with optional BGM.
 * Keep this adapter as the boundary for future content blocks such as images,
 * PDFs, dividers, or chat bubbles so phase delivery UI can keep selecting the
 * same creator-friendly ViewModel instead of backend wire fields.
 */
export function toReadingSectionPickerOption(
  section: Pick<ReadingSectionResponse, "id" | "name" | "bgmMediaId"> & { lines?: unknown },
): ReadingSectionPickerOption {
  const lines = normalizeReadingLines(section.lines);
  const lineCount = lines.length;
  return {
    id: section.id,
    name: section.name.trim() || "이름 없는 스토리 정보",
    summary: buildSummary(lines),
    metaLabel: section.bgmMediaId ? `${lineCount}줄 · BGM 있음` : `${lineCount}줄`,
    groupLabel: inferGroupLabel(lines),
  };
}

export function toReadingSectionPickerOptions(
  sections: Array<Pick<ReadingSectionResponse, "id" | "name" | "lines" | "bgmMediaId">>,
): ReadingSectionPickerOption[] {
  return sections
    .slice()
    .sort((a, b) => (readSortOrder(a) - readSortOrder(b)) || a.name.localeCompare(b.name, "ko"))
    .map(toReadingSectionPickerOption);
}

export function filterReadingSectionOptions(
  options: ReadingSectionPickerOption[],
  query: string,
): ReadingSectionPickerOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) =>
    [option.name, option.summary, option.groupLabel]
      .some((value) => value.toLowerCase().includes(needle)),
  );
}

function normalizeReadingLines(lines: unknown): ReadingLineView[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((line): line is Record<string, unknown> => !!line && typeof line === "object")
    .map((line) => ({
      Text: typeof line.Text === "string" ? line.Text : "",
      Speaker: typeof line.Speaker === "string" ? line.Speaker : "",
    }));
}

function buildSummary(lines: Pick<ReadingLineView, "Text">[]): string {
  const text = lines
    .map((line) => line.Text?.trim())
    .filter(Boolean)
    .join(" ");
  if (!text) return EMPTY_SUMMARY;
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

function inferGroupLabel(lines: ReadingLineView[]): string {
  const speakers = new Set(lines.map((line) => line.Speaker?.trim()).filter(Boolean));
  if (lines.length === 0) return "빈 정보";
  if (speakers.size === 0) return "공통 서술";
  if (speakers.size === 1) return "캐릭터 대사";
  return "합독 정보";
}

function readSortOrder(section: unknown): number {
  if (!section || typeof section !== "object" || !("sortOrder" in section)) return 0;
  const value = (section as { sortOrder?: unknown }).sortOrder;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
