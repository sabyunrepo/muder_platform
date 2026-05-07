import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Eye,
  FileText,
  Image,
  Music,
  Save,
  Sparkles,
  Video,
} from "lucide-react";
import {
  createEmptyBlock,
  defaultScript,
  parseReadingScript,
  readMockBlocks,
  type BlockType,
  type ReadingBlock,
  writeMockBlocks,
} from "@/features/editor/mockReadingBlocks";
import { BlockCard } from "./ReadingScriptEditorMockControls";

const typeLabels: Record<BlockType, string> = {
  dialogue: "대사",
  image: "이미지",
  video: "영상",
  bgm: "BGM",
  gmNote: "GM 메모",
};

const typeIcons = {
  dialogue: FileText,
  image: Image,
  video: Video,
  bgm: Music,
  gmNote: Sparkles,
};

export default function ReadingScriptEditorMockPage() {
  const [script, setScript] = useState(defaultScript);
  const [blocks, setBlocks] = useState<ReadingBlock[]>(() => readMockBlocks());
  const [selectedId, setSelectedId] = useState(blocks[0]?.id ?? "");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const selected = useMemo(() => blocks.find((block) => block.id === selectedId) ?? blocks[0], [blocks, selectedId]);

  function replaceFromScript() {
    const next = parseReadingScript(script);
    setBlocks(next);
    setSelectedId(next[0]?.id ?? "");
    writeMockBlocks(next);
    setScriptModalOpen(false);
  }

  function addBlock(type: BlockType) {
    const nextBlock = createEmptyBlock(type);
    const next = [...blocks, nextBlock];
    setBlocks(next);
    setSelectedId(nextBlock.id);
    writeMockBlocks(next);
  }

  function updateBlock(id: string, patch: Partial<ReadingBlock>) {
    const next = blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as ReadingBlock) : block));
    setBlocks(next);
    writeMockBlocks(next);
  }

  function removeBlock(id: string) {
    const next = blocks.filter((block) => block.id !== id);
    setBlocks(next);
    setSelectedId(next[0]?.id ?? "");
    writeMockBlocks(next);
  }

  function moveBlock(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const from = blocks.findIndex((block) => block.id === draggingId);
    const to = blocks.findIndex((block) => block.id === targetId);
    if (from < 0 || to < 0) return;
    const next = blocks.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setBlocks(next);
    writeMockBlocks(next);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">Reading Script Mock</p>
            <h1 className="mt-1 text-2xl font-semibold">읽기 대사 블록 에디터 목업</h1>
            <p className="mt-1 text-sm text-slate-400">대본으로 자동 생성하거나, 블록을 직접 추가한 뒤 줄별 세부 설정을 조정합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dev/reading-player"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-400"
            >
              <Eye className="h-4 w-4" />
              테스트 화면 열기
            </Link>
            <button
              type="button"
              onClick={() => writeMockBlocks(blocks)}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-900"
            >
              <Save className="h-4 w-4" />
              목업 저장
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-[calc(100vh-89px)] p-4">
        <section className="min-h-0 rounded-md border border-slate-800 bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
            <div>
              <h2 className="text-sm font-semibold">블록 편집</h2>
              <p className="mt-1 text-xs text-slate-500">드래그로 순서를 바꾸고, 각 블록의 음성/이미지/진행을 바로 수정합니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScriptModalOpen(true)}
                className="inline-flex min-h-9 items-center gap-2 rounded-md bg-amber-500 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                <Sparkles className="h-4 w-4" />
                대본 입력
              </button>
              {(["dialogue", "image", "video", "bgm", "gmNote"] as BlockType[]).map((type) => {
                const Icon = typeIcons[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addBlock(type)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300 hover:border-amber-500/60"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {typeLabels[type]}
                  </button>
                );
              })}
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs text-slate-400">{blocks.length}개</span>
            </div>
          </div>
          <div className="space-y-2 p-4">
            {blocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                index={index}
                selected={selected?.id === block.id}
                onSelect={() => setSelectedId(block.id)}
                onDelete={() => removeBlock(block.id)}
                onUpdate={(patch) => updateBlock(block.id, patch)}
                onDragStart={() => setDraggingId(block.id)}
                onDrop={() => moveBlock(block.id)}
              />
            ))}
          </div>
        </section>
      </div>

      {scriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <section className="w-full max-w-2xl rounded-md border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
            <div className="border-b border-slate-800 p-4">
              <h2 className="text-base font-semibold">대본 입력으로 블록 생성</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">화자: 대사, 이미지:, 영상:, BGM: 지시를 입력하면 현재 블록 목록으로 변환합니다.</p>
            </div>
            <div className="space-y-4 p-4">
              <textarea
                value={script}
                onChange={(event) => setScript(event.currentTarget.value)}
                className="h-80 w-full resize-none rounded-md border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-amber-500"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setScriptModalOpen(false)} className="min-h-10 rounded-md border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800">취소</button>
                <button type="button" onClick={replaceFromScript} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                  <Sparkles className="h-4 w-4" />
                  블록 생성
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
