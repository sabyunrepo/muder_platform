import type { MediaType } from '@/features/editor/mediaApi';

export type MediaEmbedType = 'image' | 'video';
export type MediaEmbedAlign = 'left' | 'center' | 'right';
export type MediaEmbedWidth = 'small' | 'medium' | 'large' | 'full';

export interface MediaEmbedAttributes {
  mediaId: string;
  type: MediaEmbedType;
  align: MediaEmbedAlign;
  width: MediaEmbedWidth;
}

export interface MdxAttributeLike {
  type?: string;
  name?: string | null;
  value?: unknown;
}

export interface MediaEmbedMdastNode {
  attributes: MdxAttributeLike[];
}

export const mediaEmbedAligns: MediaEmbedAlign[] = ['left', 'center', 'right'];
export const mediaEmbedWidths: MediaEmbedWidth[] = ['small', 'medium', 'large', 'full'];

export function mediaTypeToEmbedType(type: MediaType): MediaEmbedType {
  return type === 'VIDEO' ? 'video' : 'image';
}

export function createMediaEmbedSnippet(
  mediaId: string,
  type: MediaEmbedType,
  align: MediaEmbedAlign = 'center',
  width: MediaEmbedWidth = 'medium'
) {
  return `\n\n<MediaEmbed mediaId="${mediaId}" type="${type}" align="${align}" width="${width}" />\n`;
}

export function insertMediaEmbedParagraph(
  markdown: string,
  target: MediaEmbedAttributes,
  position: 'before' | 'after'
) {
  const range = findMediaEmbedRange(markdown, target);
  if (!range) return markdown;
  const insertion = '\n\n';
  return position === 'before'
    ? `${markdown.slice(0, range.start)}${insertion}${markdown.slice(range.start)}`
    : `${markdown.slice(0, range.end)}${insertion}${markdown.slice(range.end)}`;
}

export function moveMediaEmbedBlock(
  markdown: string,
  target: MediaEmbedAttributes,
  direction: 'up' | 'down'
) {
  const blocks = readMediaEmbedBlocks(markdown);
  const targetIndex = blocks.findIndex((block) => mediaEmbedMatches(block.attrs, target));
  if (targetIndex < 0) return markdown;

  const neighborIndex = direction === 'up' ? targetIndex - 1 : targetIndex + 1;
  const neighbor = blocks[neighborIndex];
  const targetBlock = blocks[targetIndex];
  if (!neighbor || !targetBlock) return markdown;

  if (direction === 'up') {
    return replaceRange(
      markdown,
      neighbor.start,
      targetBlock.end,
      `${targetBlock.source}${markdown.slice(neighbor.end, targetBlock.start)}${neighbor.source}`
    );
  }

  return replaceRange(
    markdown,
    targetBlock.start,
    neighbor.end,
    `${neighbor.source}${markdown.slice(targetBlock.end, neighbor.start)}${targetBlock.source}`
  );
}

export function moveMediaEmbedBlockTo(
  markdown: string,
  source: MediaEmbedAttributes,
  target: MediaEmbedAttributes,
  position: 'before' | 'after'
) {
  if (mediaEmbedMatches(source, target)) return markdown;

  const sourceRange = findMediaEmbedRange(markdown, source);
  if (!sourceRange) return markdown;

  const sourceText = markdown.slice(sourceRange.start, sourceRange.end);
  const withoutSource = replaceRange(markdown, sourceRange.start, sourceRange.end, '');
  const targetRange = findMediaEmbedRange(withoutSource, target);
  if (!targetRange) return markdown;

  const insertAt = position === 'before' ? targetRange.start : targetRange.end;
  return `${withoutSource.slice(0, insertAt)}\n\n${sourceText}\n\n${withoutSource.slice(insertAt)}`;
}

export function readMediaEmbedAttributes(node: MediaEmbedMdastNode): MediaEmbedAttributes {
  const mediaId = readStringAttribute(node, 'mediaId');
  const type = readStringAttribute(node, 'type') === 'video' ? 'video' : 'image';
  const align = normalizeAlign(readStringAttribute(node, 'align'));
  const width = normalizeWidth(readStringAttribute(node, 'width'));
  return { mediaId, type, align, width };
}

export function readMediaEmbedAttributesFromSource(attrs: string): MediaEmbedAttributes {
  const sourceNode: MediaEmbedMdastNode = {
    attributes: Array.from(attrs.matchAll(/(\w+)=["']([^"']+)["']/g)).map((match) => ({
      name: match[1],
      value: match[2],
    })),
  };
  return readMediaEmbedAttributes(sourceNode);
}

function findMediaEmbedRange(markdown: string, target: MediaEmbedAttributes) {
  return readMediaEmbedBlocks(markdown).find((block) => mediaEmbedMatches(block.attrs, target));
}

function readMediaEmbedBlocks(markdown: string) {
  return Array.from(markdown.matchAll(/<MediaEmbed\s+([^>]+)\/>/g)).map((match) => {
    const attrs = readMediaEmbedAttributesFromSource(match[1] ?? '');
    const start = match.index ?? 0;
    const source = match[0];
    return {
      attrs,
      start,
      end: start + source.length,
      source,
    };
  });
}

function mediaEmbedMatches(current: MediaEmbedAttributes, target: MediaEmbedAttributes) {
  return (
    current.mediaId === target.mediaId &&
    current.type === target.type &&
    current.align === target.align &&
    current.width === target.width
  );
}

function replaceRange(markdown: string, start: number, end: number, replacement: string) {
  return `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`;
}

export function updateMediaEmbedAttributes(
  node: MediaEmbedMdastNode,
  patch: Partial<MediaEmbedAttributes>
) {
  const current = readMediaEmbedAttributes(node);
  const next = { ...current, ...patch };
  return {
    attributes: [
      ...withoutKnownMediaEmbedAttributes(node.attributes),
      stringAttribute('mediaId', next.mediaId),
      stringAttribute('type', next.type),
      stringAttribute('align', next.align),
      stringAttribute('width', next.width),
    ],
  };
}

function readStringAttribute(node: MediaEmbedMdastNode, name: string) {
  const attr = node.attributes.find((item) => item.name === name);
  if (!attr) return '';
  if (typeof attr.value === 'string') return attr.value;
  if (
    attr.value &&
    typeof attr.value === 'object' &&
    'value' in attr.value &&
    typeof attr.value.value === 'string'
  ) {
    return attr.value.value;
  }
  return '';
}

function normalizeAlign(value: string): MediaEmbedAlign {
  return mediaEmbedAligns.includes(value as MediaEmbedAlign)
    ? (value as MediaEmbedAlign)
    : 'center';
}

function normalizeWidth(value: string): MediaEmbedWidth {
  return mediaEmbedWidths.includes(value as MediaEmbedWidth)
    ? (value as MediaEmbedWidth)
    : 'medium';
}

function withoutKnownMediaEmbedAttributes(attributes: MdxAttributeLike[]) {
  return attributes.filter(
    (attr) =>
      attr.name !== 'mediaId' &&
      attr.name !== 'type' &&
      attr.name !== 'align' &&
      attr.name !== 'width'
  );
}

function stringAttribute(name: string, value: string): MdxAttributeLike {
  return {
    type: 'mdxJsxAttribute',
    name,
    value,
  };
}
