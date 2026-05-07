import { RichContentPreview } from '@/features/editor/components/content/RichContentPreview';

export function InfoPreview({
  themeId,
  title,
  markdown,
}: {
  themeId: string;
  title: string;
  markdown: string;
}) {
  return (
    <RichContentPreview
      themeId={themeId}
      title={title}
      titleFallback="제목 없는 정보"
      markdown={markdown}
      ariaLabel="정보 카드 프리뷰"
      emptyMessage="본문을 작성하면 플레이어에게 보일 카드가 표시됩니다."
    />
  );
}
