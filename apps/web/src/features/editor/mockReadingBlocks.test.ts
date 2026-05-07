import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_READING_STORAGE_KEY,
  createEmptyBlock,
  defaultBlocks,
  mediaName,
  parseReadingScript,
  readMockBlocks,
  writeMockBlocks,
  type ReadingBlock,
} from "./mockReadingBlocks";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mockReadingBlocks", () => {
  it("대본 줄을 읽기 블록 타입으로 변환한다", () => {
    const blocks = parseReadingScript([
      "이미지: 저택 전경 full large",
      "영상: CCTV 01",
      "BGM: 심문 테마 반복",
      "GM: 단서를 공개한다",
      "변상훈: 저는 현장에 없었습니다.",
      "알 수 없음: 수상한 대사",
    ].join("\n"));

    expect(blocks).toHaveLength(6);
    expect(blocks[0]).toMatchObject({
      type: "image",
      mediaId: "image-mansion",
      position: "full",
      size: "large",
    });
    expect(blocks[1]).toMatchObject({ type: "video", mediaId: "video-cctv", advanceType: "voice" });
    expect(blocks[2]).toMatchObject({ type: "bgm", mediaId: "bgm-question", mode: "loop" });
    expect(blocks[3]).toMatchObject({ type: "gmNote", text: "단서를 공개한다" });
    expect(blocks[4]).toMatchObject({
      type: "dialogue",
      speaker: "변상훈",
      advanceType: "character",
      advanceCharacterId: "char-sanghun",
    });
    expect(blocks[5]).toMatchObject({ type: "dialogue", advanceType: "gm" });
  });

  it("빈 블록 기본값과 localStorage round-trip을 보장한다", () => {
    const image = createEmptyBlock("image");
    const video = createEmptyBlock("video");
    const bgmStop: ReadingBlock = { ...createEmptyBlock("bgm"), mode: "stop", mediaId: undefined };

    expect(image).toMatchObject({ type: "image", mediaId: "image-mansion" });
    expect(video).toMatchObject({ type: "video", mediaId: "video-cctv" });
    expect(mediaName(bgmStop.mediaId)).toBe("선택 없음");

    writeMockBlocks([image, video, bgmStop]);

    expect(JSON.parse(localStorage.getItem(MOCK_READING_STORAGE_KEY) ?? "[]")).toHaveLength(3);
    expect(readMockBlocks()).toEqual([image, video, bgmStop]);
  });

  it("저장값이 없거나 깨졌으면 기본 블록을 사용한다", () => {
    expect(readMockBlocks()).toEqual(defaultBlocks);

    localStorage.setItem(MOCK_READING_STORAGE_KEY, "{bad-json");

    expect(readMockBlocks()).toEqual(defaultBlocks);
  });
});
