export function normalizeLegacyEscapedMarkdown(markdown: string) {
  if (!hasLegacyEscapedMarkdown(markdown)) return markdown;

  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }

      if (inFence) return line;

      return line
        .replace(/^\\(?=>\s)/, '')
        .replace(/^\\(?=#{1,6}\s)/, '')
        .replace(/^\\(?=---\s*$)/, '')
        .replace(/^\\(?=[-*+]\s)/, '')
        .replace(/^\\(?=\d+\.\s)/, '')
        .replace(/\\([*_`~])/g, '$1');
    })
    .join('\n');
}

function hasLegacyEscapedMarkdown(markdown: string) {
  return /(^|\n)\\(?:>\s|#{1,6}\s|---\s*$|[-*+]\s|\d+\.\s)/m.test(markdown) || /\\[*_`~]/.test(markdown);
}
