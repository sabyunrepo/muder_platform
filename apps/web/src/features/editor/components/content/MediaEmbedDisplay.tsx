import { ImageOff } from 'lucide-react';

import {
  useMediaDownloadUrl,
  type MediaResponse,
} from '@/features/editor/mediaApi';
import { getMediaThumbnailUrl } from '@/features/editor/components/media/mediaVisuals';
import type {
  MediaEmbedAlign,
  MediaEmbedAttributes,
  MediaEmbedWidth,
} from './mediaEmbedMarkdown';

const widthClasses: Record<MediaEmbedWidth, string> = {
  small: 'max-w-xs',
  medium: 'max-w-md',
  large: 'max-w-2xl',
  full: 'max-w-full',
};

const alignClasses: Record<MediaEmbedAlign, string> = {
  left: 'mr-auto',
  center: 'mx-auto',
  right: 'ml-auto',
};

export function MediaEmbedDisplay({
  attrs,
  media,
}: {
  attrs: MediaEmbedAttributes;
  media: MediaResponse[];
}) {
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

  return (
    <figure
      className={`my-3 ${widthClasses[attrs.width]} ${alignClasses[attrs.align]}`}
      data-testid="media-embed-display"
    >
      {selectedMedia && visualUrl && !isVideo ? (
        <img src={visualUrl} alt={selectedMedia.name} className="block h-auto w-full object-contain" />
      ) : selectedMedia && visualUrl && isVideo && selectedMedia.source_type === 'FILE' ? (
        <video src={visualUrl} controls className="block h-auto w-full" aria-label={`${selectedMedia.name} 영상`} />
      ) : selectedMedia && visualUrl && isVideo ? (
        <img
          src={visualUrl}
          alt={`${selectedMedia.name} 영상 썸네일`}
          className="block aspect-video h-auto w-full object-cover"
        />
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded border border-dashed border-slate-700 px-4 py-6 text-center text-xs text-slate-500">
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
