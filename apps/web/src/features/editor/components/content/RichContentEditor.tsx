import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  headingsPlugin,
  jsxPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type JsxComponentDescriptor,
  type MDXEditorMethods,
} from '@mdxeditor/editor';

import { useMediaList, type MediaResponse, type MediaType } from '@/features/editor/mediaApi';
import { MediaEmbedPicker } from './MediaEmbedPicker';
import { MediaEmbedEditor } from './MediaEmbedEditor';
import {
  createMediaEmbedSnippet,
  insertMediaEmbedParagraph,
  mediaTypeToEmbedType,
  moveMediaEmbedBlock,
  moveMediaEmbedBlockTo,
  type MediaEmbedAttributes,
} from './mediaEmbedMarkdown';
import { normalizeLegacyEscapedMarkdown } from './legacyMarkdown';

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
  const normalizedMarkdown = useMemo(() => normalizeLegacyEscapedMarkdown(markdown), [markdown]);
  const markdownRef = useRef(normalizedMarkdown);
  const onChangeRef = useRef(onChange);
  const [replacementTarget, setReplacementTarget] = useState<MediaEmbedAttributes | null>(null);
  const { data: media = [] } = useMediaList(themeId);

  useEffect(() => {
    markdownRef.current = normalizedMarkdown;
    onChangeRef.current = onChange;
  }, [normalizedMarkdown, onChange]);

  useEffect(() => {
    if (editorRef.current?.getMarkdown?.() !== normalizedMarkdown) {
      editorRef.current?.setMarkdown?.(normalizedMarkdown);
    }
  }, [normalizedMarkdown]);

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      thematicBreakPlugin(),
      jsxPlugin({
        jsxComponentDescriptors: [
          createMediaEmbedDescriptor(
            media,
            (attrs) => {
              setReplacementTarget(attrs);
              onOpenPicker(attrs.type === 'video' ? 'VIDEO' : 'IMAGE');
            },
            {
              onInsertParagraph: (attrs, position) => {
                onChangeRef.current(
                  insertMediaEmbedParagraph(markdownRef.current, attrs, position)
                );
              },
              onMove: (attrs, direction) => {
                onChangeRef.current(moveMediaEmbedBlock(markdownRef.current, attrs, direction));
              },
              onDropOn: (source, target, position) => {
                onChangeRef.current(
                  moveMediaEmbedBlockTo(markdownRef.current, source, target, position)
                );
              },
            }
          ),
        ],
      }),
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
      markdownShortcutPlugin(),
    ],
    [media, onOpenPicker]
  );

  function handleSelectMedia(media: MediaResponse) {
    const type = mediaTypeToEmbedType(media.type);
    if (replacementTarget) {
      const snippet = createMediaEmbedSnippet(
        media.id,
        type,
        replacementTarget.align,
        replacementTarget.width
      ).trim();
      onChange(replaceMediaEmbed(normalizedMarkdown, replacementTarget, snippet));
      setReplacementTarget(null);
      onClosePicker();
      return;
    }
    const snippet = createMediaEmbedSnippet(media.id, type);
    editorRef.current?.insertMarkdown(snippet);
    onClosePicker();
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
          markdown={normalizedMarkdown}
          onChange={onChange}
          plugins={plugins}
          className="mmp-mdx-editor"
          contentEditableClassName="text-sm leading-6 text-slate-100"
        />
      </div>
    </div>
  );
}

function createMediaEmbedDescriptor(
  media: MediaResponse[],
  onRequestReplace: (attrs: MediaEmbedAttributes) => void,
  controls: {
    onInsertParagraph: (attrs: MediaEmbedAttributes, position: 'before' | 'after') => void;
    onMove: (attrs: MediaEmbedAttributes, direction: 'up' | 'down') => void;
    onDropOn: (
      source: MediaEmbedAttributes,
      target: MediaEmbedAttributes,
      position: 'before' | 'after'
    ) => void;
  }
): JsxComponentDescriptor {
  return {
    name: 'MediaEmbed',
    kind: 'flow',
    props: [
      { name: 'mediaId', type: 'string', required: true },
      { name: 'type', type: 'string', required: true },
      { name: 'align', type: 'string' },
      { name: 'width', type: 'string' },
    ],
    hasChildren: false,
    Editor: (props) => (
      <MediaEmbedEditor
        {...props}
        media={media}
        onRequestReplace={onRequestReplace}
        onInsertParagraph={controls.onInsertParagraph}
        onMove={controls.onMove}
        onDropOn={controls.onDropOn}
      />
    ),
  };
}

function replaceMediaEmbed(markdown: string, target: MediaEmbedAttributes, nextSnippet: string) {
  const pattern = /<MediaEmbed\s+([^>]+)\/>/g;
  for (const match of markdown.matchAll(pattern)) {
    const attrs = match[1] ?? '';
    if (
      readAttr(attrs, 'mediaId') !== target.mediaId ||
      (readAttr(attrs, 'type') || 'image') !== target.type ||
      (readAttr(attrs, 'align') || 'center') !== target.align ||
      (readAttr(attrs, 'width') || 'medium') !== target.width
    ) {
      continue;
    }
    const index = match.index ?? 0;
    return `${markdown.slice(0, index)}${nextSnippet}${markdown.slice(index + match[0].length)}`;
  }
  return markdown;
}

function readAttr(attrs: string, name: string) {
  return new RegExp(`\\b${name}=["']([^"']+)["']`).exec(attrs)?.[1] ?? '';
}
