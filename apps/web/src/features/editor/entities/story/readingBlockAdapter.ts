import type { AdvanceBy, ReadingBgmMode, ReadingBlockType, ReadingLineDTO } from "../../readingApi";
import type { MediaType } from "../../mediaApi";

export interface ReadingParserCharacter {
  id: string;
  name: string;
}

export interface ReadingParserMedia {
  id: string;
  name: string;
  type: MediaType;
}

export interface ReadingParseIssue {
  lineNumber: number;
  kind: "unknown-speaker" | "unknown-media" | "empty-directive";
  value: string;
}

export interface ReadingParseResult {
  blocks: ReadingLineDTO[];
  issues: ReadingParseIssue[];
}

export function parseReadingScriptToBlocks(
  input: string,
  options: {
    characters: ReadingParserCharacter[];
    media: ReadingParserMedia[];
  },
): ReadingParseResult {
  const issues: ReadingParseIssue[] = [];
  const blocks = input
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), lineNumber: index + 1 }))
    .filter((line) => line.raw.length > 0)
    .map(({ raw, lineNumber }, index): ReadingLineDTO => {
      const [rawHead, ...rest] = raw.split(/[:：]/);
      const head = rawHead.trim();
      const body = rest.join(":").trim();

      if (!head || rest.length === 0) {
        issues.push({ lineNumber, kind: "empty-directive", value: raw });
        return dialogueBlock(index, "나레이션", raw, "gm");
      }

      if (head === "이미지") {
        const media = findMedia(body, "IMAGE", options.media);
        if (!media) issues.push({ lineNumber, kind: "unknown-media", value: body });
        return mediaBlock(index, "image", media?.id ?? "", "gm", {
          Position: inferImagePosition(body),
          Size: inferImageSize(body),
        });
      }

      if (head === "영상") {
        const media = findMedia(body, "VIDEO", options.media);
        if (!media) issues.push({ lineNumber, kind: "unknown-media", value: body });
        return mediaBlock(index, "video", media?.id ?? "", "gm", {
          Autoplay: true,
          WaitUntilEnd: true,
        });
      }

      if (head.toUpperCase() === "BGM") {
        const mode = inferBgmMode(body);
        const media = mode === "stop" ? null : findMedia(body, "BGM", options.media);
        if (mode !== "stop" && !media) {
          issues.push({ lineNumber, kind: "unknown-media", value: body });
        }
        return {
          Index: index,
          Type: "bgm",
          Text: "",
          MediaID: media?.id ?? "",
          BGMMode: mode,
        };
      }

      if (head.toUpperCase() === "GM") {
        return {
          Index: index,
          Type: "gmNote",
          Text: body,
        };
      }

      const character = options.characters.find((item) => item.name === head);
      if (!character && head !== "나레이션") {
        issues.push({ lineNumber, kind: "unknown-speaker", value: head });
      }
      return dialogueBlock(
        index,
        head || "나레이션",
        body || raw,
        character ? `role:${character.id}` : "gm",
      );
    });

  return { blocks, issues };
}

export function normalizeReadingBlocks(lines: ReadingLineDTO[]): ReadingLineDTO[] {
  return lines.map((line, index) => ({
    ...line,
    Index: index,
    Type: normalizeBlockType(line.Type),
    Text: line.Text ?? "",
  }));
}

export function isDialogueBlock(line: ReadingLineDTO): boolean {
  return normalizeBlockType(line.Type) === "dialogue";
}

function dialogueBlock(index: number, speaker: string, text: string, advanceBy: AdvanceBy): ReadingLineDTO {
  return {
    Index: index,
    Type: "dialogue",
    Text: text,
    Speaker: speaker,
    AdvanceBy: advanceBy,
  };
}

function mediaBlock(
  index: number,
  type: Extract<ReadingBlockType, "image" | "video">,
  mediaId: string,
  advanceBy: AdvanceBy,
  extras: Partial<ReadingLineDTO>,
): ReadingLineDTO {
  return {
    Index: index,
    Type: type,
    Text: "",
    MediaID: mediaId,
    AdvanceBy: advanceBy,
    ...extras,
  };
}

function findMedia(name: string, type: MediaType, media: ReadingParserMedia[]): ReadingParserMedia | null {
  const normalized = normalizeLookupName(name);
  if (!normalized) return null;
  return media.find((item) => item.type === type && normalizeLookupName(item.name) === normalized) ?? null;
}

function normalizeLookupName(value: string): string {
  const controlWords = ["반복", "1회", "한번", "정지", "loop", "once", "stop", "full", "large", "small", "left", "right", "center"];
  let normalized = value;
  for (const word of controlWords) {
    normalized = normalized.replaceAll(word, "");
  }
  return normalized
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferImagePosition(value: string): ReadingLineDTO["Position"] {
  const lower = value.toLowerCase();
  if (lower.includes("left")) return "left";
  if (lower.includes("right")) return "right";
  if (lower.includes("full")) return "full";
  return "center";
}

function inferImageSize(value: string): ReadingLineDTO["Size"] {
  const lower = value.toLowerCase();
  if (lower.includes("small")) return "small";
  if (lower.includes("large") || lower.includes("full")) return "large";
  return "medium";
}

function inferBgmMode(value: string): ReadingBgmMode {
  const lower = value.toLowerCase();
  if (lower.includes("정지") || lower.includes("stop")) return "stop";
  if (lower.includes("1회") || lower.includes("한번") || lower.includes("once")) return "once";
  return "loop";
}

function normalizeBlockType(type: ReadingLineDTO["Type"]): ReadingBlockType {
  return type ?? "dialogue";
}
