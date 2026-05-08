import { useMemo, useRef, useState } from 'react';
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import { ImageOff, RefreshCw, Trash2, Video } from 'lucide-react';

import {
  useMediaDownloadUrl,
  useMediaList,
  type MediaResponse,
  type MediaType,
} from '@/features/editor/mediaApi';
import { getMediaThumbnailUrl } from '@/features/editor/components/media/mediaVisuals';
import { MediaEmbedPicker } from './MediaEmbedPicker';

const mediaEmbedPattern = /<MediaEmbed\s+mediaId=["']([^"']+)["']\s+type=["']([^"']+)["']\s*\/>/g;

interface MediaEmbedToken {
  id: string;
  mediaId: string;
  type: 'image' | 'video';
  snippet: string;
}

export function RichContentEditor({
  themeId,
  markdown,
  onChange,
  pickerType,
  onOpenPicker,
  onClosePicker,
  ariaLabel,
  imageButtonLabel,
  videoButtonLabel,
  imagePickerTitle,
  videoPickerTitle,
  onBlurCapture,
}: {
  themeId: string;
  markdown: string;
  onChange: (markdown: string) => void;
  pickerType: MediaType | null;
  onOpenPicker: (type: MediaType) => void;
  onClosePicker: () => void;
  ariaLabel: string;
  imageButtonLabel?: string;
  videoButtonLabel?: string;
  imagePickerTitle?: string;
  videoPickerTitle?: string;
  onBlurCapture?: (relatedTarget: EventTarget | null) => void;
}) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const [replacementTarget, setReplacementTarget] = useState<MediaEmbedToken | null>(null);
  const { data: media = [] } = useMediaList(themeId);
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      thematicBreakPlugin(),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <UndoRedo />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles />
            <ListsToggle />
            <CreateLink />
          </>
        ),
      }),
    ],
    [],
  );
  const embeds = useMemo(() => parseMediaEmbeds(markdown), [markdown]);

  function handleSelectMedia(media: MediaResponse) {
    const type = media.type === 'VIDEO' ? 'video' : 'image';
    const snippet = `\n\n<MediaEmbed mediaId="${media.id}" type="${type}" />\n`;
    if (replacementTarget) {
      onChange(replaceMediaEmbed(markdown, replacementTarget, snippet));
      setReplacementTarget(null);
      onClosePicker();
      return;
    }
    editorRef.current?.insertMarkdown(snippet);
    onClosePicker();
  }

  function handleRemoveEmbed(embed: MediaEmbedToken) {
    onChange(removeMediaEmbed(markdown, embed));
  }

  function handleReplaceEmbed(embed: MediaEmbedToken) {
    setReplacementTarget(embed);
    onOpenPicker(embed.type === 'video' ? 'VIDEO' : 'IMAGE');
  }

  function handleClosePicker() {
    setReplacementTarget(null);
    onClosePicker();
  }

  return (
    <div
      className="space-y-2"
      role="region"
      aria-label={ariaLabel}
      onBlurCapture={(event) => onBlurCapture?.(event.relatedTarget)}
    >
      <MediaEmbedPicker
        themeId={themeId}
        pickerType={pickerType}
        imageButtonLabel={imageButtonLabel}
        videoButtonLabel={videoButtonLabel}
        imagePickerTitle={replacementTarget ? '교체할 이미지 선택' : imagePickerTitle}
        videoPickerTitle={replacementTarget ? '교체할 영상 선택' : videoPickerTitle}
        onOpen={onOpenPicker}
        onClose={handleClosePicker}
        onSelect={handleSelectMedia}
      />
      <div className="mmp-rich-content-surface">
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={onChange}
          plugins={plugins}
          className="mmp-mdx-editor"
          contentEditableClassName="text-sm leading-6 text-slate-100"
        />
        {embeds.length > 0 && (
          <div className="border-t border-slate-800 bg-slate-950/80 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              {embeds.map((embed) => (
                <MediaEmbedBlock
                  key={embed.id}
                  embed={embed}
                  media={media.find((item) => item.id === embed.mediaId) ?? null}
                  onReplace={() => handleReplaceEmbed(embed)}
                  onRemove={() => handleRemoveEmbed(embed)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaEmbedBlock({
  embed,
  media,
  onReplace,
  onRemove,
}: {
  embed: MediaEmbedToken;
  media: MediaResponse | null;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const shouldFetchDownloadUrl = Boolean(
    media && media.source_type === 'FILE' && !media.url && (media.type === 'IMAGE' || media.type === 'VIDEO'),
  );
  const { data, isLoading, isError } = useMediaDownloadUrl(shouldFetchDownloadUrl ? media?.id : undefined);
  const visualUrl = media ? getMediaThumbnailUrl(media) ?? media.url ?? data?.url ?? null : null;
  const isVideo = embed.type === 'video';

  return (
    <figure className="overflow-hidden rounded border border-slate-800 bg-slate-900/80">
      <div className="flex aspect-video items-center justify-center bg-slate-950">
        {media && visualUrl && !isVideo ? (
          <img src={visualUrl} alt={media.name} className="h-full w-full object-contain" />
        ) : media && visualUrl && isVideo && media.source_type === 'FILE' ? (
          <video src={visualUrl} controls className="h-full w-full" aria-label={`${media.name} 영상`} />
        ) : media && visualUrl && isVideo ? (
          <div
            className="flex h-full w-full items-end bg-cover bg-center"
            style={{ backgroundImage: `url(${visualUrl})` }}
            role="img"
            aria-label={`${media.name} 영상 썸네일`}
          >
            <div className="flex w-full items-center gap-2 bg-slate-950/80 px-3 py-2 text-xs text-slate-200">
              <Video className="h-4 w-4 text-rose-300" />
              영상 미디어
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-slate-500">
            <ImageOff className="h-6 w-6" />
            {media
              ? isLoading
                ? '미디어를 불러오는 중입니다'
                : isError
                  ? '미디어 URL을 가져오지 못했습니다'
                  : '표시할 미디어 URL이 없습니다'
              : '삭제되었거나 접근할 수 없는 미디어입니다'}
          </div>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-200">
            {media?.name ?? embed.mediaId}
          </p>
          <p className="text-[11px] text-slate-500">{isVideo ? '영상' : '이미지'} 블록</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onReplace}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label={`${media?.name ?? embed.mediaId} 교체`}
            title="교체"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1.5 text-rose-300 hover:bg-rose-500/10"
            aria-label={`${media?.name ?? embed.mediaId} 삭제`}
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </figcaption>
    </figure>
  );
}

function parseMediaEmbeds(markdown: string): MediaEmbedToken[] {
  return Array.from(markdown.matchAll(mediaEmbedPattern), (match, index) => ({
    id: `${match.index ?? index}:${match[0]}`,
    mediaId: match[1],
    type: match[2] === 'video' ? 'video' : 'image',
    snippet: match[0],
  }));
}

function replaceMediaEmbed(markdown: string, embed: MediaEmbedToken, nextSnippet: string) {
  return markdown.replace(embed.snippet, nextSnippet.trim());
}

function removeMediaEmbed(markdown: string, embed: MediaEmbedToken) {
  return markdown.replace(embed.snippet, '').replace(/\n{3,}/g, '\n\n').trim();
}
