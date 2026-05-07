import { useMemo, useRef } from 'react';
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

import type { MediaResponse, MediaType } from '@/features/editor/mediaApi';
import { MediaEmbedPicker } from './MediaEmbedPicker';

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

  function handleSelectMedia(media: MediaResponse) {
    const type = media.type === 'VIDEO' ? 'video' : 'image';
    const snippet = `\n\n<MediaEmbed mediaId="${media.id}" type="${type}" />\n`;
    editorRef.current?.insertMarkdown(snippet);
    onClosePicker();
  }

  return (
    <div
      className="space-y-2"
      aria-label={ariaLabel}
      onBlurCapture={(event) => onBlurCapture?.(event.relatedTarget)}
    >
      <MediaEmbedPicker
        themeId={themeId}
        pickerType={pickerType}
        imageButtonLabel={imageButtonLabel}
        videoButtonLabel={videoButtonLabel}
        imagePickerTitle={imagePickerTitle}
        videoPickerTitle={videoPickerTitle}
        onOpen={onOpenPicker}
        onClose={onClosePicker}
        onSelect={handleSelectMedia}
      />
      <MDXEditor
        ref={editorRef}
        markdown={markdown}
        onChange={onChange}
        plugins={plugins}
        className="mmp-mdx-editor"
        contentEditableClassName="text-sm leading-6 text-slate-100"
      />
    </div>
  );
}
