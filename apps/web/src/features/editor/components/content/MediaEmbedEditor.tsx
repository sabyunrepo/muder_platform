import type { DragEvent, KeyboardEvent } from 'react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useLexicalNodeRemove, useMdastNodeUpdater } from '@mdxeditor/editor';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImageOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import { useMediaDownloadUrl, type MediaResponse } from '@/features/editor/mediaApi';
import { getMediaThumbnailUrl } from '@/features/editor/components/media/mediaVisuals';
import {
  mediaEmbedAligns,
  mediaEmbedWidths,
  readMediaEmbedAttributes,
  updateMediaEmbedAttributes,
  type MediaEmbedAlign,
  type MediaEmbedAttributes,
  type MediaEmbedMdastNode,
  type MediaEmbedWidth,
} from './mediaEmbedMarkdown';

const alignLabels: Record<MediaEmbedAlign, string> = {
  left: '왼쪽 정렬',
  center: '가운데 정렬',
  right: '오른쪽 정렬',
};

const widthLabels: Record<MediaEmbedWidth, string> = {
  small: '작게',
  medium: '보통',
  large: '크게',
  full: '전체폭',
};

const alignIcons = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

const widthClasses: Record<MediaEmbedWidth, string> = {
  small: 'w-fit max-w-xs',
  medium: 'w-fit max-w-md',
  large: 'w-fit max-w-2xl',
  full: 'w-full max-w-full',
};

const alignClasses: Record<MediaEmbedAlign, string> = {
  left: 'mr-auto',
  center: 'mx-auto',
  right: 'ml-auto',
};

const mediaEmbedDragType = 'application/x-mmp-media-embed';

export function MediaEmbedEditor({
  mdastNode,
  media,
  onRequestReplace,
  onInsertParagraph,
  onMove,
  onDropOn,
}: JsxEditorProps & {
  media: MediaResponse[];
  onRequestReplace: (attrs: MediaEmbedAttributes) => void;
  onInsertParagraph: (attrs: MediaEmbedAttributes, position: 'before' | 'after') => void;
  onMove: (attrs: MediaEmbedAttributes, direction: 'up' | 'down') => void;
  onDropOn: (
    source: MediaEmbedAttributes,
    target: MediaEmbedAttributes,
    position: 'before' | 'after'
  ) => void;
}) {
  const node = mdastNode as MediaEmbedMdastNode;
  const attrs = readMediaEmbedAttributes(node);
  const updateMdastNode = useMdastNodeUpdater<MediaEmbedMdastNode>();
  const removeNode = useLexicalNodeRemove();
  const selectedMedia = media.find((item) => item.id === attrs.mediaId) ?? null;
  const isVideo = attrs.type === 'video';
  const shouldFetchDownloadUrl = Boolean(
    selectedMedia &&
    selectedMedia.source_type === 'FILE' &&
    !selectedMedia.url &&
    (selectedMedia.type === 'IMAGE' || selectedMedia.type === 'VIDEO')
  );
  const { data, isLoading, isError } = useMediaDownloadUrl(
    shouldFetchDownloadUrl ? selectedMedia?.id : undefined
  );
  const visualUrl = selectedMedia
    ? (getMediaThumbnailUrl(selectedMedia) ?? selectedMedia.url ?? data?.url ?? null)
    : null;

  function patchAttributes(patch: Partial<typeof attrs>) {
    updateMdastNode(updateMediaEmbedAttributes(node, patch));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-rich-content-control="true"]')) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onInsertParagraph(attrs, event.shiftKey ? 'before' : 'after');
    }
    if (event.key === 'ArrowUp' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onMove(attrs, 'up');
    }
    if (event.key === 'ArrowDown' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onMove(attrs, 'down');
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(mediaEmbedDragType, JSON.stringify(attrs));
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (event.dataTransfer.types.includes(mediaEmbedDragType)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    const raw = event.dataTransfer.getData(mediaEmbedDragType);
    if (!raw) return;
    event.preventDefault();
    try {
      const source = JSON.parse(raw) as MediaEmbedAttributes;
      const position =
        event.clientY <
        event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight / 2
          ? 'before'
          : 'after';
      onDropOn(source, attrs, position);
    } catch {
      // Ignore invalid drag payloads from outside this editor.
    }
  }

  return (
    <figure
      className={`group relative my-4 rounded outline outline-1 outline-slate-700/70 transition focus:outline-2 focus:outline-amber-400 focus-within:outline-2 focus-within:outline-amber-400 ${widthClasses[attrs.width]} ${alignClasses[attrs.align]}`}
      data-testid="media-embed-editor"
      role="group"
      aria-label={`${selectedMedia?.name ?? attrs.mediaId} 미디어 블록`}
      contentEditable={false}
      draggable
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <MediaInsertionRail position="before" onInsert={() => onInsertParagraph(attrs, 'before')} />
      <MediaToolbar
        attrs={attrs}
        label={selectedMedia?.name ?? attrs.mediaId}
        onMoveUp={() => onMove(attrs, 'up')}
        onMoveDown={() => onMove(attrs, 'down')}
        onReplace={() => onRequestReplace(attrs)}
        onRemove={removeNode}
        onPatch={patchAttributes}
      />
      {selectedMedia && visualUrl && !isVideo ? (
        <img
          src={visualUrl}
          alt={selectedMedia.name}
          className={
            attrs.width === 'full'
              ? 'block h-auto w-full object-contain'
              : 'block h-auto max-w-full object-contain'
          }
        />
      ) : selectedMedia && visualUrl && isVideo && selectedMedia.source_type === 'FILE' ? (
        <video
          src={visualUrl}
          controls
          className="block h-auto w-full"
          aria-label={`${selectedMedia.name} 영상`}
        />
      ) : selectedMedia && visualUrl && isVideo ? (
        <img
          src={visualUrl}
          alt={`${selectedMedia.name} 영상 썸네일`}
          className="block aspect-video h-auto w-full object-cover"
        />
      ) : (
        <div className="flex min-h-32 min-w-60 flex-col items-center justify-center gap-2 rounded bg-slate-950 px-4 py-6 text-center text-xs text-slate-500">
          <ImageOff className="h-6 w-6" />
          {selectedMedia
            ? isLoading
              ? '미디어를 불러오는 중입니다'
              : isError
                ? '미디어 URL을 가져오지 못했습니다'
                : '표시할 미디어 URL이 없습니다'
            : '삭제되었거나 접근할 수 없는 미디어입니다'}
        </div>
      )}
      <p className="sr-only">
        Enter를 누르면 아래에 문단 위치를 추가하고, Shift Enter는 위에 추가합니다. Command 또는
        Control과 위아래 화살표로 블록 순서를 바꿀 수 있습니다.
      </p>
      <MediaInsertionRail position="after" onInsert={() => onInsertParagraph(attrs, 'after')} />
    </figure>
  );
}

function MediaInsertionRail({
  position,
  onInsert,
}: {
  position: 'before' | 'after';
  onInsert: () => void;
}) {
  return (
    <button
      type="button"
      data-rich-content-control="true"
      className={`absolute left-0 z-10 flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] font-medium text-amber-100 opacity-0 transition focus:opacity-100 group-focus:opacity-100 group-hover:opacity-100 ${
        position === 'before' ? '-top-5' : '-bottom-5'
      }`}
      onClick={onInsert}
      aria-label={position === 'before' ? '미디어 위에 문단 추가' : '미디어 아래에 문단 추가'}
      title={position === 'before' ? '위에 문단 추가' : '아래에 문단 추가'}
    >
      <span className="h-px flex-1 bg-amber-300/70" aria-hidden="true" />
      <span className="rounded-full bg-slate-950/95 px-2 py-0.5 ring-1 ring-amber-300/50">
        {position === 'before' ? '위에 문단' : '아래에 문단'}
      </span>
      <span className="h-px flex-1 bg-amber-300/70" aria-hidden="true" />
    </button>
  );
}

function MediaToolbar({
  attrs,
  label,
  onMoveUp,
  onMoveDown,
  onReplace,
  onRemove,
  onPatch,
}: {
  attrs: MediaEmbedAttributes;
  label: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<MediaEmbedAttributes>) => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-1 rounded bg-slate-950/90 p-1 opacity-0 shadow-lg shadow-slate-950/30 ring-1 ring-slate-700/80 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <span className="rounded p-1 text-slate-400" aria-hidden="true" title="드래그해서 순서 이동">
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        data-rich-content-control="true"
        onClick={onMoveUp}
        className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
        aria-label={`${label} 위로 이동`}
        title="위로 이동"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        data-rich-content-control="true"
        onClick={onMoveDown}
        className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
        aria-label={`${label} 아래로 이동`}
        title="아래로 이동"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        data-rich-content-control="true"
        onClick={onReplace}
        className="rounded p-1.5 text-slate-200 hover:bg-slate-800"
        aria-label={`${label} 교체`}
        title="교체"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      {mediaEmbedAligns.map((align) => {
        const Icon = alignIcons[align];
        return (
          <button
            key={align}
            type="button"
            data-rich-content-control="true"
            onClick={() => onPatch({ align })}
            className={`rounded p-1.5 ${
              attrs.align === align
                ? 'bg-amber-500/15 text-amber-200'
                : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`}
            aria-label={alignLabels[align]}
            title={alignLabels[align]}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
      {mediaEmbedWidths.map((width) => (
        <button
          key={width}
          type="button"
          data-rich-content-control="true"
          onClick={() => onPatch({ width })}
          className={`rounded px-1.5 py-1 text-[11px] font-medium ${
            attrs.width === width
              ? 'bg-amber-500/15 text-amber-200'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          }`}
          aria-label={widthLabels[width]}
          title={widthLabels[width]}
        >
          {width === 'small' ? <Minimize2 className="h-3.5 w-3.5" /> : null}
          {width === 'medium' ? <WidthGlyph size="medium" /> : null}
          {width === 'large' ? <WidthGlyph size="large" /> : null}
          {width === 'full' ? <Maximize2 className="h-3.5 w-3.5" /> : null}
        </button>
      ))}
      <button
        type="button"
        data-rich-content-control="true"
        onClick={onRemove}
        className="rounded p-1.5 text-rose-300 hover:bg-rose-500/10"
        aria-label={`${label} 삭제`}
        title="삭제"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function WidthGlyph({ size }: { size: 'medium' | 'large' }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-3 rounded-sm border border-current ${size === 'medium' ? 'w-3.5' : 'w-5'}`}
    />
  );
}
