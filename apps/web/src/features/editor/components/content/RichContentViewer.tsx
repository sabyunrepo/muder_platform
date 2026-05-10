import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { useMediaList } from '@/features/editor/mediaApi';
import { MediaEmbedDisplay } from './MediaEmbedDisplay';
import { readMediaEmbedAttributesFromSource } from './mediaEmbedMarkdown';

type RichContentPart =
  | { type: 'markdown'; value: string }
  | { type: 'media'; attrs: ReturnType<typeof readMediaEmbedAttributesFromSource> };

export function RichContentViewer({
  themeId,
  markdown,
}: {
  themeId: string;
  markdown: string;
}) {
  const { data: media = [] } = useMediaList(themeId);
  const parts = splitRichContent(markdown);

  return (
    <div className="space-y-3 text-sm leading-6 text-slate-100">
      {parts.map((part, index) =>
        part.type === 'media' ? (
          <MediaEmbedDisplay key={`media:${index}:${part.attrs.mediaId}`} attrs={part.attrs} media={media} />
        ) : (
          <MarkdownFragment key={`markdown:${index}`} markdown={part.value} />
        ),
      )}
    </div>
  );
}

function MarkdownFragment({ markdown }: { markdown: string }) {
  const html = DOMPurify.sanitize(marked.parse(markdown, { async: false }) as string);
  if (!html.trim()) return null;
  return (
    <div
      className="space-y-2 [&_a]:text-amber-300 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-700 [&_blockquote]:pl-3 [&_blockquote]:text-slate-300 [&_code]:rounded [&_code]:bg-slate-900 [&_code]:px-1 [&_code]:text-amber-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:text-slate-100 [&_strong]:font-semibold [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function splitRichContent(markdown: string): RichContentPart[] {
  const pattern = /<MediaEmbed\s+([^>]+)\/>/g;
  const parts: RichContentPart[] = [];
  let cursor = 0;

  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ type: 'markdown', value: markdown.slice(cursor, index) });
    }
    parts.push({ type: 'media', attrs: readMediaEmbedAttributesFromSource(match[1] ?? '') });
    cursor = index + match[0].length;
  }

  if (cursor < markdown.length) {
    parts.push({ type: 'markdown', value: markdown.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: 'markdown', value: markdown }];
}
