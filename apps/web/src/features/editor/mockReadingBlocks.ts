export type AdvanceType = "gm" | "voice" | "character";
export type BlockType = "dialogue" | "image" | "video" | "bgm" | "gmNote";
export type BgmMode = "loop" | "once" | "stop";

export interface MockCharacter {
  id: string;
  name: string;
}

export interface MockMedia {
  id: string;
  name: string;
  type: "image" | "video" | "bgm" | "voice";
  url?: string;
}

interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface DialogueBlock extends BaseBlock {
  type: "dialogue";
  speaker: string;
  text: string;
  voiceMediaId?: string;
  imageMediaId?: string;
  advanceType: AdvanceType;
  advanceCharacterId?: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  mediaId: string;
  position: "left" | "center" | "right" | "full";
  size: "small" | "medium" | "large";
  advanceType: "gm" | "character";
  advanceCharacterId?: string;
}

export interface VideoBlock extends BaseBlock {
  type: "video";
  mediaId: string;
  autoplay: boolean;
  waitUntilEnd: boolean;
  advanceType: "gm" | "voice" | "character";
  advanceCharacterId?: string;
}

export interface BgmBlock extends BaseBlock {
  type: "bgm";
  mediaId?: string;
  mode: BgmMode;
}

export interface GmNoteBlock extends BaseBlock {
  type: "gmNote";
  text: string;
}

export type ReadingBlock = DialogueBlock | ImageBlock | VideoBlock | BgmBlock | GmNoteBlock;

export const MOCK_READING_STORAGE_KEY = "mmp:mock-reading-blocks:v1";

export const mockCharacters: MockCharacter[] = [
  { id: "gm", name: "방장" },
  { id: "char-sanghun", name: "변상훈" },
  { id: "char-yuna", name: "윤서연" },
  { id: "char-minjae", name: "한민재" },
];

export const mockMedia: MockMedia[] = [
  {
    id: "image-mansion",
    name: "저택 전경",
    type: "image",
    url: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "image-hall",
    name: "어두운 복도",
    type: "image",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  },
  { id: "video-cctv", name: "CCTV 01", type: "video" },
  { id: "bgm-opening", name: "긴장감 오프닝", type: "bgm" },
  { id: "bgm-question", name: "심문 테마", type: "bgm" },
  { id: "voice-001", name: "opening_001.mp3", type: "voice" },
  { id: "voice-002", name: "sanghun_001.mp3", type: "voice" },
  { id: "voice-003", name: "opening_003.mp3", type: "voice" },
];

let nextBlockId = 100;

function createId(prefix: string): string {
  nextBlockId += 1;
  return `${prefix}-${nextBlockId}`;
}

function syncNextBlockId(blocks: ReadingBlock[]): void {
  const maxSuffix = blocks.reduce((max, block) => {
    const suffix = Number(block.id.split("-").at(-1));
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
  }, 0);
  nextBlockId = Math.max(nextBlockId, maxSuffix);
}

export const defaultScript = `나레이션: 모두 눈을 감아주세요.
이미지: 저택 전경
변상훈: 저는 아무것도 보지 못했습니다.
BGM: 심문 테마 반복
나레이션: 첫 번째 조사를 시작합니다.`;

export const defaultBlocks: ReadingBlock[] = [
  {
    id: "dialogue-1",
    type: "dialogue",
    speaker: "나레이션",
    text: "모두 눈을 감아주세요.",
    voiceMediaId: "voice-001",
    advanceType: "gm",
  },
  {
    id: "image-2",
    type: "image",
    mediaId: "image-mansion",
    position: "center",
    size: "large",
    advanceType: "gm",
  },
  {
    id: "dialogue-3",
    type: "dialogue",
    speaker: "변상훈",
    text: "저는 아무것도 보지 못했습니다.",
    voiceMediaId: "voice-002",
    advanceType: "character",
    advanceCharacterId: "char-sanghun",
  },
  {
    id: "bgm-4",
    type: "bgm",
    mediaId: "bgm-question",
    mode: "loop",
  },
  {
    id: "dialogue-5",
    type: "dialogue",
    speaker: "나레이션",
    text: "첫 번째 조사를 시작합니다.",
    advanceType: "gm",
  },
];

export function parseReadingScript(input: string): ReadingBlock[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): ReadingBlock => {
      const [rawHead, ...rest] = line.split(/[:：]/);
      const head = rawHead.trim();
      const body = rest.join(":").trim();
      const lower = body.toLowerCase();

      if (head === "이미지") {
        return {
          id: createId("image"),
          type: "image",
          mediaId: findMediaId(body, "image") ?? "image-mansion",
          position: lower.includes("full") ? "full" : "center",
          size: lower.includes("small") ? "small" : lower.includes("large") ? "large" : "medium",
          advanceType: "gm",
        };
      }

      if (head === "영상") {
        return {
          id: createId("video"),
          type: "video",
          mediaId: findMediaId(body, "video") ?? "video-cctv",
          autoplay: true,
          waitUntilEnd: true,
          advanceType: "voice",
        };
      }

      if (head.toUpperCase() === "BGM") {
        return {
          id: createId("bgm"),
          type: "bgm",
          mediaId: parseBgmMediaId(body),
          mode: parseBgmMode(body),
        };
      }

      if (head.toUpperCase() === "GM") {
        return { id: createId("note"), type: "gmNote", text: body || line };
      }

      const character = mockCharacters.find((item) => item.name === head);
      return {
        id: createId("dialogue"),
        type: "dialogue",
        speaker: head || "나레이션",
        text: body || line,
        advanceType: head === "나레이션" || !character ? "gm" : "character",
        advanceCharacterId: character?.id,
      };
    });
}

export function createEmptyBlock(type: BlockType): ReadingBlock {
  if (type === "image") {
    return {
      id: createId("image"),
      type,
      mediaId: "image-mansion",
      position: "center",
      size: "medium",
      advanceType: "gm",
    };
  }
  if (type === "video") {
    return {
      id: createId("video"),
      type,
      mediaId: "video-cctv",
      autoplay: true,
      waitUntilEnd: true,
      advanceType: "voice",
    };
  }
  if (type === "bgm") {
    return { id: createId("bgm"), type, mediaId: "bgm-opening", mode: "loop" };
  }
  if (type === "gmNote") {
    return { id: createId("note"), type, text: "여기에 GM 진행 메모를 작성하세요." };
  }
  return {
    id: createId("dialogue"),
    type,
    speaker: "나레이션",
    text: "새 대사를 입력하세요.",
    advanceType: "gm",
  };
}

export function readMockBlocks(): ReadingBlock[] {
  try {
    const raw = localStorage.getItem(MOCK_READING_STORAGE_KEY);
    if (!raw) {
      syncNextBlockId(defaultBlocks);
      return defaultBlocks;
    }
    const parsed = JSON.parse(raw);
    const blocks = isReadingBlockArray(parsed) ? parsed : defaultBlocks;
    syncNextBlockId(blocks);
    return blocks;
  } catch {
    syncNextBlockId(defaultBlocks);
    return defaultBlocks;
  }
}

export function writeMockBlocks(blocks: ReadingBlock[]) {
  localStorage.setItem(MOCK_READING_STORAGE_KEY, JSON.stringify(blocks));
}

export function mediaName(id?: string): string {
  if (!id) return "선택 없음";
  return mockMedia.find((media) => media.id === id)?.name ?? "삭제된 미디어";
}

export function characterName(id?: string): string {
  if (!id) return "방장";
  return mockCharacters.find((character) => character.id === id)?.name ?? "알 수 없음";
}

function findMediaId(label: string, type: MockMedia["type"]): string | undefined {
  const compact = label.replace(/\s+/g, "").toLowerCase();
  return mockMedia.find(
    (media) => media.type === type && compact.includes(media.name.replace(/\s+/g, "").toLowerCase())
  )?.id;
}

function isBgmStop(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("정지") || lower.includes("stop");
}

function parseBgmMode(text: string): BgmMode {
  if (isBgmStop(text)) {
    return "stop";
  }
  const lower = text.toLowerCase();
  return lower.includes("1회") || lower.includes("once") ? "once" : "loop";
}

function parseBgmMediaId(text: string) {
  if (isBgmStop(text)) {
    return undefined;
  }
  return findMediaId(text, "bgm") ?? "bgm-opening";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isStringValue(value: unknown): value is string {
  return typeof value === "string";
}

function isBooleanValue(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isStringValue(value);
}

function isAdvanceType(value: unknown): value is AdvanceType {
  return value === "gm" || value === "voice" || value === "character";
}

function isImageAdvanceType(value: unknown): value is ImageBlock["advanceType"] {
  return value === "gm" || value === "character";
}

function isImagePosition(value: unknown): value is ImageBlock["position"] {
  return value === "left" || value === "center" || value === "right" || value === "full";
}

function isImageSize(value: unknown): value is ImageBlock["size"] {
  return value === "small" || value === "medium" || value === "large";
}

function isBgmMode(value: unknown): value is BgmMode {
  return value === "loop" || value === "once" || value === "stop";
}

function isReadingBlock(value: unknown): value is ReadingBlock {
  if (!isObjectRecord(value) || !isStringValue(value.id)) return false;

  switch (value.type) {
    case "dialogue":
      return (
        isStringValue(value.speaker) &&
        isStringValue(value.text) &&
        isAdvanceType(value.advanceType) &&
        isOptionalString(value.voiceMediaId) &&
        isOptionalString(value.imageMediaId) &&
        isOptionalString(value.advanceCharacterId)
      );
    case "image":
      return (
        isStringValue(value.mediaId) &&
        isImagePosition(value.position) &&
        isImageSize(value.size) &&
        isImageAdvanceType(value.advanceType) &&
        isOptionalString(value.advanceCharacterId)
      );
    case "video":
      return (
        isStringValue(value.mediaId) &&
        isBooleanValue(value.autoplay) &&
        isBooleanValue(value.waitUntilEnd) &&
        isAdvanceType(value.advanceType) &&
        isOptionalString(value.advanceCharacterId)
      );
    case "bgm":
      return isOptionalString(value.mediaId) && isBgmMode(value.mode);
    case "gmNote":
      return isStringValue(value.text);
    default:
      return false;
  }
}

function isReadingBlockArray(value: unknown): value is ReadingBlock[] {
  return Array.isArray(value) && value.every(isReadingBlock);
}
