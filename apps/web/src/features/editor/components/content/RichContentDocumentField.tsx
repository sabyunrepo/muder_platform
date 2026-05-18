import { useEffect, useRef, useState } from 'react';
import { Edit3, Eye } from 'lucide-react';

import type { MediaType } from '@/features/editor/mediaApi';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';
import { RichContentEditor } from './RichContentEditor';
import { RichContentViewer } from './RichContentViewer';
import { hasDisplayableRichContent } from './richContentDisplay';

interface RichContentDocumentFieldProps {
  themeId: string;
  documentIdentity?: string;
  markdown: string;
  onChange: (markdown: string) => void;
  previewAriaLabel: string;
  editorAriaLabel: string;
  editButtonLabel: string;
  previewButtonLabel?: string;
  emptyPreviewMessage?: string;
  imageButtonLabel?: string;
  videoButtonLabel?: string;
  imagePickerTitle?: string;
  videoPickerTitle?: string;
  externalResetKey?: string | number;
  onBlurCapture?: (relatedTarget: EventTarget | null) => void;
  onRequestPreview?: () => void;
}

export function RichContentDocumentField({
  themeId,
  documentIdentity,
  markdown,
  onChange,
  previewAriaLabel,
  editorAriaLabel,
  editButtonLabel,
  previewButtonLabel = '미리보기',
  emptyPreviewMessage = '아직 작성된 본문이 없습니다.',
  imageButtonLabel,
  videoButtonLabel,
  imagePickerTitle,
  videoPickerTitle,
  externalResetKey,
  onBlurCapture,
  onRequestPreview,
}: RichContentDocumentFieldProps) {
  const [pickerType, setPickerType] = useState<MediaType | null>(null);
  const [mode, setMode] = useState<'preview' | 'edit'>(() =>
    hasDisplayableRichContent(markdown) ? 'preview' : 'edit',
  );
  const openedEditorRef = useRef(false);
  const editorInteractedRef = useRef(false);

  useEffect(() => {
    if (
      !openedEditorRef.current &&
      !editorInteractedRef.current &&
      mode === 'edit' &&
      hasDisplayableRichContent(markdown)
    ) {
      setMode('preview');
    }
  }, [markdown, mode]);

  if (mode === 'preview' && hasDisplayableRichContent(markdown)) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              openedEditorRef.current = true;
              setMode('edit');
            }}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 ${editorDesignClassNames.secondaryAction}`}
          >
            <Edit3 className="h-4 w-4" />
            {editButtonLabel}
          </button>
        </div>
        <div role="region" aria-label={previewAriaLabel}>
          <RichContentViewer themeId={themeId} markdown={markdown} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          data-rich-content-control="true"
          onClick={() => {
            onRequestPreview?.();
            if (hasDisplayableRichContent(markdown)) {
              openedEditorRef.current = false;
              setMode('preview');
            }
          }}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 ${editorDesignClassNames.secondaryAction}`}
        >
          <Eye className="h-4 w-4" />
          {previewButtonLabel}
        </button>
      </div>
      <div
        onKeyDownCapture={() => {
          editorInteractedRef.current = true;
        }}
        onPointerDownCapture={() => {
          editorInteractedRef.current = true;
        }}
      >
        <RichContentEditor
          themeId={themeId}
          documentIdentity={documentIdentity}
          markdown={markdown}
          onChange={onChange}
          pickerType={pickerType}
          onOpenPicker={setPickerType}
          onClosePicker={() => setPickerType(null)}
          ariaLabel={editorAriaLabel}
          imageButtonLabel={imageButtonLabel}
          videoButtonLabel={videoButtonLabel}
          imagePickerTitle={imagePickerTitle}
          videoPickerTitle={videoPickerTitle}
          externalResetKey={externalResetKey}
          onBlurCapture={onBlurCapture}
        />
      </div>
      {!hasDisplayableRichContent(markdown) ? (
        <p className="text-xs leading-5 text-[var(--mmp-editor-color-slate)]">
          {emptyPreviewMessage}
        </p>
      ) : null}
    </div>
  );
}
