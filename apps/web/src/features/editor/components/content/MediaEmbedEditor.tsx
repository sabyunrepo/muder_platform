import type { JsxEditorProps } from '@mdxeditor/editor';
import { useLexicalNodeRemove, useMdastNodeUpdater } from '@mdxeditor/editor';
import { AlignCenter, AlignLeft, AlignRight, ImageOff, Maximize2, Minimize2, RefreshCw, Trash2 } from 'lucide-react';

import {
  useMediaDownloadUrl,
  type MediaResponse,
} from '@/features/editor/mediaApi';
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

export function MediaEmbedEditor({
  mdastNode,
  media,
  onRequestReplace,
}: JsxEditorProps & {
  media: MediaResponse[];
  onRequestReplace: (attrs: MediaEmbedAttributes) => void;
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
      (selectedMedia.type === 'IMAGE' || selectedMedia.type === 'VIDEO'),
  );
  const { data, isLoading, isError } = useMediaDownloadUrl(
    shouldFetchDownloadUrl ? selectedMedia?.id : undefined,
  );
  const visualUrl = selectedMedia
    ? getMediaThumbnailUrl(selectedMedia) ?? selectedMedia.url ?? data?.url ?? null
    : null;

  function patchAttributes(patch: Partial<typeof attrs>) {
    updateMdastNode(updateMediaEmbedAttributes(node, patch));
  }

  return (
    <figure
      className={`group relative my-3 rounded outline outline-1 outline-slate-700/70 focus-within:outline-amber-400 ${widthClasses[attrs.width]} ${alignClasses[attrs.align]}`}
      data-testid="media-embed-editor"
      contentEditable={false}
    >
      <MediaToolbar
        attrs={attrs}
        label={selectedMedia?.name ?? attrs.mediaId}
        onReplace={() => onRequestReplace(attrs)}
        onRemove={removeNode}
        onPatch={patchAttributes}
      />
      {selectedMedia && visualUrl && !isVideo ? (
        <img
          src={visualUrl}
          alt={selectedMedia.name}
          className={attrs.width === 'full' ? 'block h-auto w-full object-contain' : 'block h-auto max-w-full object-contain'}
        />
      ) : selectedMedia && visualUrl && isVideo && selectedMedia.source_type === 'FILE' ? (
        <video src={visualUrl} controls className="block h-auto w-full" aria-label={`${selectedMedia.name} 영상`} />
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
    </figure>
  );
}

function MediaToolbar({
  attrs,
  label,
  onReplace,
  onRemove,
  onPatch,
}: {
  attrs: MediaEmbedAttributes;
  label: string;
  onReplace: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<MediaEmbedAttributes>) => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-1 rounded bg-slate-950/90 p-1 opacity-0 shadow-lg shadow-slate-950/30 ring-1 ring-slate-700/80 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <button
        type="button"
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
          {width === 'medium' ? 'M' : null}
          {width === 'large' ? 'L' : null}
          {width === 'full' ? <Maximize2 className="h-3.5 w-3.5" /> : null}
        </button>
      ))}
      <button
        type="button"
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
