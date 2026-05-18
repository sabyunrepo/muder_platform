export function hasDisplayableRichContent(markdown: string | null | undefined) {
  return Boolean(markdown?.trim());
}
