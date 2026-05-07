import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { useMediaList } from '@/features/editor/mediaApi';

const mediaEmbedPattern = /<MediaEmbed\s+mediaId=["']([^"']+)["']\s+type=["']([^"']+)["']\s*\/>/g;

export function RichContentPreview({
  themeId,
  title,
  titleFallback,
  markdown,
  ariaLabel,
  eyebrow = 'Preview',
  emptyMessage,
}: {
  themeId: string;
  title: string;
  titleFallback: string;
  markdown: string;
  ariaLabel: string;
  eyebrow?: string;
  emptyMessage: string;
}) {
  const { data: media = [] } = useMediaList(themeId);
  const markdownWithMedia = markdown.replace(
    mediaEmbedPattern,
    (_, mediaId: string, type: string) => {
      const item = media.find((candidate) => candidate.id === mediaId);
      const label = item?.name ?? '삭제되었거나 접근할 수 없는 미디어';
      const kind = type === 'video' ? '영상' : '이미지';
      return `\n\n> ${kind}: ${label}\n\n`;
    },
  );
  const html = DOMPurify.sanitize(marked.parse(markdownWithMedia, { async: false }) as string);

  return (
    <section
      className="rounded border border-slate-800 bg-slate-950 p-4"
      aria-label={ariaLabel}
    >
      <div className="mb-3 border-b border-slate-800 pb-3">
        <p className="text-xs uppercase tracking-wide text-amber-300">{eyebrow}</p>
        <h3 className="mt-1 text-base font-semibold text-slate-100">
          {title.trim() || titleFallback}
        </h3>
      </div>
      {markdown.trim() ? (
        <div
          className="prose prose-invert max-w-none text-sm leading-6 text-slate-200"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      )}
    </section>
  );
}
