import type { MediaType } from '@/features/editor/mediaApi';
import { RichContentEditor } from '@/features/editor/components/content/RichContentEditor';

export function InfoMarkdownEditor({
  themeId,
  documentIdentity,
  markdown,
  onChange,
  pickerType,
  onOpenPicker,
  onClosePicker,
}: {
  themeId: string;
  documentIdentity?: string;
  markdown: string;
  onChange: (markdown: string) => void;
  pickerType: MediaType | null;
  onOpenPicker: (type: MediaType) => void;
  onClosePicker: () => void;
}) {
  return (
    <RichContentEditor
      themeId={themeId}
      documentIdentity={documentIdentity}
      markdown={markdown}
      onChange={onChange}
      pickerType={pickerType}
      onOpenPicker={onOpenPicker}
      onClosePicker={onClosePicker}
      ariaLabel="정보 본문 작성기"
      imagePickerTitle="정보 이미지 선택"
      videoPickerTitle="정보 영상 선택"
    />
  );
}
