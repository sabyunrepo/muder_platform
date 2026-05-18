export const TRAILING_EMPTY_PARAGRAPH_MARKDOWN = '\u200B';

export function appendTrailingEmptyParagraph(markdown: string) {
  const body = markdown.replace(/\s+$/, '');
  return body
    ? `${body}\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`
    : TRAILING_EMPTY_PARAGRAPH_MARKDOWN;
}

export function normalizeTrailingEmptyParagraphInput(markdown: string) {
  return markdown.replace(/(^|\n)\u200B(?=[^\n]*\S)/g, '$1');
}

export function isPlainEnterKey(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'>
) {
  return (
    event.key === 'Enter' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.isComposing
  );
}

export function isCollapsedSelectionAtEndOfElement(element: HTMLElement) {
  const selection = element.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return false;
  if (!isSelectionInLastEditableBlock(element, range)) return false;

  const afterSelection = range.cloneRange();
  afterSelection.selectNodeContents(element);
  afterSelection.setStart(range.endContainer, range.endOffset);
  return afterSelection.toString().length === 0 && !hasElementContentAfterRange(element, range);
}

const EDITABLE_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li';

function isSelectionInLastEditableBlock(element: HTMLElement, range: Range) {
  if (range.endContainer === element) return true;

  const selectedBlock = findClosestEditableBlock(element, range.endContainer);
  if (!selectedBlock) return true;

  const editableBlocks = Array.from(
    element.querySelectorAll<HTMLElement>(EDITABLE_BLOCK_SELECTOR)
  ).filter((block) => !block.closest('[contenteditable="false"]'));
  const lastBlock = editableBlocks.at(-1);

  return !lastBlock || selectedBlock === lastBlock;
}

function findClosestEditableBlock(element: HTMLElement, node: Node) {
  const candidate = node instanceof HTMLElement ? node : node.parentElement;
  const block = candidate?.closest<HTMLElement>(EDITABLE_BLOCK_SELECTOR);
  return block && element.contains(block) ? block : null;
}

function hasElementContentAfterRange(element: HTMLElement, range: Range) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
      if (node === element) return NodeFilter.FILTER_SKIP;
      if (node.contains(range.endContainer)) return NodeFilter.FILTER_SKIP;
      if (isEmptyEditorParagraph(node)) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    const nodeRange = element.ownerDocument.createRange();
    nodeRange.selectNode(node);
    if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0) {
      return true;
    }
    node = walker.nextNode();
  }

  return false;
}

function isEmptyEditorParagraph(node: HTMLElement) {
  if (node.textContent?.trim()) return false;
  if (node.tagName !== 'P') return node.childElementCount === 0;
  return node.childElementCount === 0 || Array.from(node.children).every((child) => child.tagName === 'BR');
}
