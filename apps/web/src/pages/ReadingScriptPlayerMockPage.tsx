import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Image,
  Mic,
  Music,
  Pause,
  Play,
  SkipForward,
  User,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import {
  characterName,
  mediaName,
  mockMedia,
  readMockBlocks,
  type BgmBlock,
  type DialogueBlock,
  type ImageBlock,
  type ReadingBlock,
  type VideoBlock,
} from "@/features/editor/mockReadingBlocks";

const voiceDurationMs = 2600;

export default function ReadingScriptPlayerMockPage() {
  const [blocks, setBlocks] = useState<ReadingBlock[]>(() => readMockBlocks());
  const [index, setIndex] = useState(0);
  const [voiceReady, setVoiceReady] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);
  const latestRef = useRef<HTMLDivElement | null>(null);

  const current = blocks[index];
  const visibleBlocks = blocks.slice(0, index + 1);
  const activeBgm = useMemo(() => getActiveBgm(blocks, index), [blocks, index]);
  const background = useMemo(() => getBackgroundImage(blocks, index), [blocks, index]);
  const blockingVoice = getBlockingVoice(current);
  const canContinue = !blockingVoice || voiceReady;
  const ownerLabel = getAdvanceOwner(current);
  const stepLabel = blocks.length > 0 ? `${index + 1} / ${blocks.length}` : "0 / 0";

  const goNext = useCallback(() => {
    setIndex((currentIndex) => Math.min(currentIndex + 1, Math.max(blocks.length - 1, 0)));
  }, [blocks.length]);

  useEffect(() => {
    setBlocks(readMockBlocks());
  }, []);

  useEffect(() => {
    setVoiceReady(!blockingVoice);
    setAutoApplied(false);

    if (!blockingVoice) return;
    const timer = window.setTimeout(() => setVoiceReady(true), voiceDurationMs);
    return () => window.clearTimeout(timer);
  }, [blockingVoice, index]);

  useEffect(() => {
    if (!current || current.type !== "bgm" || autoApplied) return;
    setAutoApplied(true);
    const timer = window.setTimeout(() => goNext(), 900);
    return () => window.clearTimeout(timer);
  }, [autoApplied, current, goNext, index]);

  useEffect(() => {
    latestRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [index, voiceReady]);

  return (
    <div
      className="mmp-runtime-boundary relative min-h-screen overflow-hidden"
      data-game-runtime-theme="immersive"
    >
      {background ? (
        <img className="absolute inset-0 h-full w-full object-cover opacity-45" src={background} alt="" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,color-mix(in_oklab,var(--mmp-color-info)_26%,transparent),transparent_35%),linear-gradient(180deg,var(--mmp-color-canvas),var(--mmp-color-surface))]" />
      )}
      <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--mmp-color-canvas)_64%,transparent)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 backdrop-blur md:px-5">
          <div className="flex items-center gap-3">
            <Link
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              to="/dev/reading-script"
              title="편집 목업으로 이동"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Reading Test</p>
              <h1 className="text-lg font-semibold">읽기 대사 테스트 화면</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill icon={Clapperboard} label={stepLabel} />
            <StatusPill icon={User} label={ownerLabel} />
            <StatusPill icon={Music} label={activeBgm} />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col px-4 py-5 md:px-6">
          <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4">
            {!current ? (
              <EmptyState />
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded border border-[var(--mmp-color-hairline)] bg-[color-mix(in_oklab,var(--mmp-color-canvas)_40%,transparent)] p-3 md:p-5">
                  {visibleBlocks.map((block, visibleIndex) => (
                    <div key={block.id} ref={visibleIndex === visibleBlocks.length - 1 ? latestRef : undefined}>
                      <CurrentBlockView
                        block={block}
                        blockingVoice={visibleIndex === visibleBlocks.length - 1 ? blockingVoice : null}
                        voiceReady={visibleIndex === visibleBlocks.length - 1 ? voiceReady : true}
                      />
                    </div>
                  ))}
                </div>
                <PlaybackControls
                  canContinue={canContinue}
                  isLast={index >= blocks.length - 1}
                  ownerLabel={ownerLabel}
                  onNext={goNext}
                />
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function CurrentBlockView({
  block,
  blockingVoice,
  voiceReady,
}: {
  block: ReadingBlock;
  blockingVoice: string | null;
  voiceReady: boolean;
}) {
  if (block.type === "dialogue") {
    return <DialogueView block={block} blockingVoice={blockingVoice} voiceReady={voiceReady} />;
  }

  if (block.type === "image") {
    return <ImageView block={block} />;
  }

  if (block.type === "video") {
    return <VideoView block={block} blockingVoice={blockingVoice} voiceReady={voiceReady} />;
  }

  if (block.type === "bgm") {
    return <BgmView block={block} />;
  }

  return (
    <div className="max-w-2xl rounded border border-amber-400/30 bg-slate-900/70 p-6 text-left shadow-2xl shadow-black/30">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Check className="h-4 w-4" />
        GM 진행 메모
      </p>
      <p className="whitespace-pre-wrap text-xl leading-relaxed text-slate-100">{block.text}</p>
    </div>
  );
}

function DialogueView({
  block,
  blockingVoice,
  voiceReady,
}: {
  block: DialogueBlock;
  blockingVoice: string | null;
  voiceReady: boolean;
}) {
  const image = mediaUrl(block.imageMediaId);

  return (
    <div className="w-full rounded-md border border-white/10 bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-slate-200">
        <Mic className="h-4 w-4 text-amber-300" />
        {block.speaker}
      </div>
      {image ? <img className="mb-3 max-h-72 w-full rounded border border-white/10 object-cover shadow-2xl shadow-black/40" src={image} alt="" /> : null}
      <p className="whitespace-pre-wrap text-xl font-semibold leading-relaxed text-white drop-shadow md:text-2xl">{block.text}</p>
      {blockingVoice ? <VoiceProgress ready={voiceReady} label={mediaName(blockingVoice)} /> : null}
    </div>
  );
}

function ImageView({ block }: { block: ImageBlock }) {
  const url = mediaUrl(block.mediaId);
  const widthClass = block.size === "small" ? "max-w-md" : block.size === "large" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div className="w-full rounded-md border border-white/10 bg-slate-900/70 p-4">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-slate-200">
        <Image className="h-4 w-4 text-amber-300" />
        {mediaName(block.mediaId)} · {block.position}
      </div>
      {url ? (
        <img className={`mx-auto max-h-[62vh] ${widthClass} rounded border border-white/10 object-cover shadow-2xl shadow-black/50`} src={url} alt="" />
      ) : (
        <div className="mx-auto flex h-72 max-w-2xl items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400">미디어 프리뷰 없음</div>
      )}
    </div>
  );
}

function VideoView({
  block,
  blockingVoice,
  voiceReady,
}: {
  block: VideoBlock;
  blockingVoice: string | null;
  voiceReady: boolean;
}) {
  return (
    <div className="w-full rounded-md border border-white/10 bg-slate-900/70 p-4">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-slate-200">
        <Play className="h-4 w-4 text-amber-300" />
        {mediaName(block.mediaId)}
      </div>
      <div className="flex aspect-video max-h-[46vh] items-center justify-center rounded border border-white/10 bg-black/60 shadow-2xl shadow-black/50">
        <div className="space-y-3 text-slate-300">
          <Clapperboard className="mx-auto h-12 w-12 text-amber-300" />
          <p>{block.autoplay ? "자동 재생" : "수동 재생"} · {block.waitUntilEnd ? "종료 대기" : "즉시 진행 가능"}</p>
        </div>
      </div>
      {blockingVoice ? <VoiceProgress ready={voiceReady} label="영상 종료 대기" /> : null}
    </div>
  );
}

function BgmView({ block }: { block: BgmBlock }) {
  const label = block.mode === "stop" ? "현재 BGM 정지" : `${mediaName(block.mediaId)} · ${block.mode === "loop" ? "다음 BGM까지 반복" : "1회 재생"}`;

  return (
    <div className="max-w-xl rounded border border-cyan-300/30 bg-slate-900/75 p-8 shadow-2xl shadow-black/30">
      <Music className="mx-auto mb-4 h-12 w-12 text-cyan-200" />
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">BGM Cue</p>
      <p className="mt-3 text-2xl font-semibold text-white">{label}</p>
      <p className="mt-3 text-sm text-slate-400">BGM 큐는 적용 후 자동으로 다음 블록으로 넘어갑니다.</p>
    </div>
  );
}

function VoiceProgress({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="mx-auto w-full max-w-md rounded border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
        <span className="inline-flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-blue-300" />
          {ready ? "재생 완료" : "재생 중"}
        </span>
        <span>{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-800">
        <div className={`h-full rounded bg-blue-400 ${ready ? "w-full" : "w-2/3 animate-pulse"}`} />
      </div>
    </div>
  );
}

function PlaybackControls({
  canContinue,
  isLast,
  ownerLabel,
  onNext,
}: {
  canContinue: boolean;
  isLast: boolean;
  ownerLabel: string;
  onNext: () => void;
}) {
  return (
    <div className="flex justify-center">
      <button className="inline-flex min-h-14 items-center gap-2 rounded-full bg-blue-500 px-7 text-lg font-semibold text-white shadow-lg shadow-blue-950/40 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700" disabled={!canContinue || isLast} onClick={onNext} type="button">
        {canContinue ? <SkipForward className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        {isLast ? "섹션 종료" : canContinue ? `${ownerLabel} 계속` : "음성 종료 대기"}
      </button>
    </div>
  );
}

function StatusPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
      <Icon className="h-4 w-4 text-amber-300" />
      <span>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-white/10 bg-white/5 p-8 text-slate-300">
      편집 목업에서 대사 블록을 먼저 만들어주세요.
    </div>
  );
}

function getBlockingVoice(block?: ReadingBlock): string | null {
  if (!block) return null;
  if (block.type === "dialogue" && block.voiceMediaId) return block.voiceMediaId;
  if (block.type === "video" && block.waitUntilEnd) return block.mediaId;
  return null;
}

function getAdvanceOwner(block?: ReadingBlock): string {
  if (!block || block.type === "bgm" || block.type === "gmNote") return "방장";
  if (block.advanceType === "character") return characterName(block.advanceCharacterId);
  if (block.advanceType === "voice") return "자동";
  return "방장";
}

function getActiveBgm(blocks: ReadingBlock[], index: number): string {
  const cues = blocks.slice(0, index + 1).filter((block): block is BgmBlock => block.type === "bgm");
  const last = cues.at(-1);
  if (!last || last.mode === "stop") return "BGM 없음";
  return `${mediaName(last.mediaId)} ${last.mode === "loop" ? "반복" : "1회"}`;
}

function getBackgroundImage(blocks: ReadingBlock[], index: number): string | undefined {
  const current = blocks[index];
  if (current?.type === "dialogue" && current.imageMediaId) return mediaUrl(current.imageMediaId);
  if (current?.type === "image") return mediaUrl(current.mediaId);
  const previousImage = blocks.slice(0, index + 1).reverse().find((block): block is ImageBlock => block.type === "image");
  return mediaUrl(previousImage?.mediaId);
}

function mediaUrl(id?: string): string | undefined {
  return mockMedia.find((media) => media.id === id)?.url;
}
