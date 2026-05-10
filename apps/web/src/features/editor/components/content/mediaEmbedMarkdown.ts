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
  width: MediaEmbedWidth = 'medium',
) {
  return `\n\n<MediaEmbed mediaId="${mediaId}" type="${type}" align="${align}" width="${width}" />\n`;
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

export function updateMediaEmbedAttributes(
  node: MediaEmbedMdastNode,
  patch: Partial<MediaEmbedAttributes>,
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
      attr.name !== 'width',
  );
}

function stringAttribute(name: string, value: string): MdxAttributeLike {
  return {
    type: 'mdxJsxAttribute',
    name,
    value,
  };
}
