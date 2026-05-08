import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clapperboard,
  Image as ImageIcon,
  Mic,
  Music,
  Pause,
  Play,
  SkipForward,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';

import type { ReadingLineDTO } from '../../readingApi';
import type { MediaResponse } from '../../mediaApi';
import { useMediaDownloadUrl } from '../../mediaApi';
import type { CharacterOption } from './readingBlockUiTypes';
import {
  getReadingPreviewActiveBgm,
  getReadingPreviewAdvanceLabel,
  getReadingPreviewBlockType,
  getReadingPreviewMediaLabel,
  getReadingPreviewMediaUrl,
  getReadingPreviewWaitMediaId,
  readingPreviewEffectSoundAdvanceDelayMs,
  readingPreviewVideoDurationMs,
  readingPreviewVoiceDurationMs,
} from './readingPreviewModel';

export interface ReadingSectionPreviewModalProps {
  open: boolean;
  sectionName: string;
  bgmMediaId?: string | null;
  bgmMode: 'loop' | 'once';
  lines: ReadingLineDTO[];
  characters: CharacterOption[];
  mediaById: Map<string, MediaResponse>;
  dirty: boolean;
  onClose: () => void;
}

export function ReadingSectionPreviewModal({
  open,
  sectionName,
  bgmMediaId,
  bgmMode,
  lines,
  characters,
  mediaById,
  dirty,
  onClose,
}: ReadingSectionPreviewModalProps) {
  const [index, setIndex] = useState(0);
  const [waitReady, setWaitReady] = useState(false);
  const autoAppliedRef = useRef(false);
  const latestRef = useRef<HTMLDivElement | null>(null);

  const currentLine = lines[index];
  const visibleLines = lines.slice(0, index + 1);
  const waitMediaId = currentLine ? getReadingPreviewWaitMediaId(currentLine) : null;
  const activeBgm = useMemo(
    () => getReadingPreviewActiveBgm(bgmMediaId, bgmMode, mediaById),
    [bgmMediaId, bgmMode, mediaById]
  );
  const stepLabel = lines.length > 0 ? `${index + 1} / ${lines.length}` : '0 / 0';
  const advanceLabel = getReadingPreviewAdvanceLabel(currentLine?.AdvanceBy, characters);
  const canContinue = !waitMediaId || waitReady;
  const isLast = lines.length === 0 || index >= lines.length - 1;

  const goNext = useCallback(() => {
    setIndex((currentIndex) => Math.min(currentIndex + 1, Math.max(lines.length - 1, 0)));
  }, [lines.length]);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setWaitReady(false);
    autoAppliedRef.current = false;
  }, [open, lines]);

  useEffect(() => {
    if (!open) return;
    setWaitReady(!waitMediaId);
    autoAppliedRef.current = false;
    if (!waitMediaId) return;

    if (!currentLine) return;
    const type = getReadingPreviewBlockType(currentLine);
    const duration =
      type === 'video' ? readingPreviewVideoDurationMs : readingPreviewVoiceDurationMs;
    const timer = window.setTimeout(() => setWaitReady(true), duration);
    return () => window.clearTimeout(timer);
  }, [currentLine, index, open, waitMediaId]);

  useEffect(() => {
    if (
      !open ||
      !currentLine ||
      autoAppliedRef.current ||
      !isEffectSoundBlock(currentLine)
    ) {
      return;
    }
    autoAppliedRef.current = true;
    if (isLast) return;
    const timer = window.setTimeout(() => goNext(), readingPreviewEffectSoundAdvanceDelayMs);
    return () => window.clearTimeout(timer);
  }, [currentLine, goNext, isLast, open]);

  useEffect(() => {
    if (!open) return;
    latestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [index, open, waitReady]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-preview-title"
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl shadow-black/50">
        <header className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              Reading Test Player
            </p>
            <h2 id="reading-preview-title" className="text-lg font-semibold">
              {sectionName} 테스트
            </h2>
            {dirty && (
              <p className="mt-1 text-xs text-amber-200">
                저장 전 변경사항을 포함해 미리보기합니다.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill icon={Clapperboard} label={stepLabel} />
            <StatusPill icon={Music} label={activeBgm} />
            <button
              type="button"
              aria-label="테스트 화면 닫기"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-5">
          {lines.length === 0 ? (
            <div className="rounded border border-dashed border-slate-700 bg-slate-900/70 p-8 text-center text-sm text-slate-300">
              테스트할 대본 블록이 없습니다.
            </div>
          ) : (
            <>
              <section className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded border border-slate-800 bg-slate-900/55 p-3 md:p-5">
                {visibleLines.map((line, visibleIndex) => (
                  <div
                    key={`${line.Index}-${visibleIndex}`}
                    ref={visibleIndex === visibleLines.length - 1 ? latestRef : undefined}
                  >
                    <PreviewBlock
                      line={line}
                      active={visibleIndex === visibleLines.length - 1}
                      waitMediaId={visibleIndex === visibleLines.length - 1 ? waitMediaId : null}
                      waitReady={visibleIndex === visibleLines.length - 1 ? waitReady : true}
                      mediaById={mediaById}
                    />
                  </div>
                ))}
              </section>
              <footer className="flex justify-center">
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinue || isLast}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-black/30 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {canContinue ? (
                    <SkipForward className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  {isLast ? '섹션 종료' : canContinue ? advanceLabel : '종료 대기'}
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function PreviewBlock({
  line,
  active,
  waitMediaId,
  waitReady,
  mediaById,
}: {
  line: ReadingLineDTO;
  active: boolean;
  waitMediaId: string | null;
  waitReady: boolean;
  mediaById: Map<string, MediaResponse>;
}) {
  const type = getReadingPreviewBlockType(line);
  if (type === 'image') return <ImageBlock line={line} mediaById={mediaById} />;
  if (type === 'video')
    return (
      <VideoBlock
        line={line}
        active={active}
        waitMediaId={waitMediaId}
        waitReady={waitReady}
        mediaById={mediaById}
      />
    );
  if (type === 'sfx' || type === 'bgm') return <EffectSoundBlock line={line} mediaById={mediaById} />;
  if (type === 'gmNote') return null;
  return (
    <DialogueBlock
      line={line}
      waitMediaId={waitMediaId}
      waitReady={waitReady}
      mediaById={mediaById}
    />
  );
}

function isEffectSoundBlock(line: ReadingLineDTO): boolean {
  const type = getReadingPreviewBlockType(line);
  return type === 'sfx' || type === 'bgm';
}

function DialogueBlock({
  line,
  waitMediaId,
  waitReady,
  mediaById,
}: {
  line: ReadingLineDTO;
  waitMediaId: string | null;
  waitReady: boolean;
  mediaById: Map<string, MediaResponse>;
}) {
  const imageUrl = getReadingPreviewMediaUrl(line.ImageMediaID, mediaById);
  return (
    <article className="rounded-md border border-slate-700 bg-slate-950/80 p-4 shadow-lg shadow-black/20">
      <BlockLabel icon={Mic} label={line.Speaker || '나레이션'} tone="text-amber-200" />
      {line.ImageMediaID && (
        <PreviewImage
          className="mt-3 max-h-72 w-full rounded border border-slate-700 object-cover"
          mediaId={line.ImageMediaID}
          src={imageUrl}
        />
      )}
      <p className="mt-3 whitespace-pre-wrap text-xl font-semibold leading-relaxed text-white md:text-2xl">
        {line.Text || '대사 본문이 비어 있습니다.'}
      </p>
      {waitMediaId && (
        <WaitProgress
          label={getReadingPreviewMediaLabel(waitMediaId, mediaById)}
          ready={waitReady}
        />
      )}
    </article>
  );
}

function ImageBlock({
  line,
  mediaById,
}: {
  line: ReadingLineDTO;
  mediaById: Map<string, MediaResponse>;
}) {
  const imageUrl = getReadingPreviewMediaUrl(line.MediaID, mediaById);
  const widthClass =
    line.Size === 'small' ? 'max-w-md' : line.Size === 'large' ? 'max-w-4xl' : 'max-w-2xl';
  return (
    <article className="rounded-md border border-sky-500/25 bg-slate-950/80 p-4">
      <BlockLabel
        icon={ImageIcon}
        label={`${getReadingPreviewMediaLabel(line.MediaID, mediaById)} · ${line.Position ?? 'center'}`}
        tone="text-sky-200"
      />
      {line.MediaID ? (
        <PreviewImage
          className={`mx-auto mt-3 max-h-[58vh] ${widthClass} rounded border border-slate-700 object-cover`}
          mediaId={line.MediaID}
          src={imageUrl}
        />
      ) : (
        <MissingMedia />
      )}
    </article>
  );
}

function VideoBlock({
  line,
  active,
  waitMediaId,
  waitReady,
  mediaById,
}: {
  line: ReadingLineDTO;
  active: boolean;
  waitMediaId: string | null;
  waitReady: boolean;
  mediaById: Map<string, MediaResponse>;
}) {
  return (
    <article className="rounded-md border border-violet-500/25 bg-slate-950/80 p-4">
      <BlockLabel
        icon={Video}
        label={getReadingPreviewMediaLabel(line.MediaID, mediaById)}
        tone="text-violet-200"
      />
      <div className="mt-3 flex aspect-video max-h-[46vh] items-center justify-center rounded border border-slate-700 bg-black/55">
        <div className="text-center text-sm text-slate-300">
          <Play className="mx-auto mb-3 h-10 w-10 text-violet-200" />
          {line.Autoplay ? '자동 재생' : '수동 재생'} ·{' '}
          {line.WaitUntilEnd ? '종료 대기' : '즉시 진행 가능'}
        </div>
      </div>
      {active && waitMediaId && <WaitProgress label="영상 종료" ready={waitReady} />}
    </article>
  );
}

function EffectSoundBlock({
  line,
  mediaById,
}: {
  line: ReadingLineDTO;
  mediaById: Map<string, MediaResponse>;
}) {
  const label = `${getReadingPreviewMediaLabel(line.MediaID, mediaById)} · 효과음 1회 재생`;
  return (
    <article className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
      <Music className="mx-auto mb-3 h-8 w-8 text-emerald-200" />
      <p className="font-semibold text-emerald-100">{label}</p>
      <p className="mt-2 text-xs text-emerald-100/70">
        효과음은 적용 후 자동으로 다음 블록으로 넘어갑니다.
      </p>
    </article>
  );
}

function WaitProgress({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="mt-4 rounded border border-slate-700 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span className="inline-flex items-center gap-2">
          {ready ? (
            <Check className="h-4 w-4 text-emerald-300" />
          ) : (
            <Pause className="h-4 w-4 text-blue-300" />
          )}
          {ready ? '종료됨' : '진행 중'}
        </span>
        <span>{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-800">
        <div className={`h-full rounded bg-blue-400 ${ready ? 'w-full' : 'w-2/3 animate-pulse'}`} />
      </div>
    </div>
  );
}

function StatusPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200">
      <Icon className="h-4 w-4 text-amber-300" />
      {label}
    </span>
  );
}

function BlockLabel({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: string;
}) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-slate-700 bg-white/5 px-3 py-1.5 text-sm ${tone}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </p>
  );
}

function MissingMedia() {
  return (
    <div className="mt-3 flex h-52 items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900 text-sm text-slate-400">
      미디어 프리뷰 없음
    </div>
  );
}

function PreviewImage({
  mediaId,
  src,
  className,
}: {
  mediaId?: string;
  src?: string;
  className: string;
}) {
  const needsDownloadUrl = Boolean(mediaId && !src);
  const { data } = useMediaDownloadUrl(needsDownloadUrl ? mediaId : undefined);
  const resolvedSrc = src ?? data?.url;

  if (!resolvedSrc) return <MissingMedia />;
  return <img className={className} src={resolvedSrc} alt="선택된 이미지 미리보기" />;
}
