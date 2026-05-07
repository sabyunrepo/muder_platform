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
import { InfoMediaEmbedPicker } from './InfoMediaEmbedPicker';

export function InfoMarkdownEditor({
  themeId,
  markdown,
  onChange,
  pickerType,
  onOpenPicker,
  onClosePicker,
}: {
  themeId: string;
  markdown: string;
  onChange: (markdown: string) => void;
  pickerType: MediaType | null;
  onOpenPicker: (type: MediaType) => void;
  onClosePicker: () => void;
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
    []
  );

  function handleSelectMedia(media: MediaResponse) {
    const type = media.type === 'VIDEO' ? 'video' : 'image';
    const snippet = `\n\n<MediaEmbed mediaId="${media.id}" type="${type}" />\n`;
    editorRef.current?.insertMarkdown(snippet);
    onClosePicker();
  }

  return (
    <div className="space-y-2" aria-label="정보 본문 작성기">
      <InfoMediaEmbedPicker
        themeId={themeId}
        pickerType={pickerType}
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
