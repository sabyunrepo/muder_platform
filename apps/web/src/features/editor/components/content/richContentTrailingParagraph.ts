export const TRAILING_EMPTY_PARAGRAPH_MARKDOWN = '<br />';

export function appendTrailingEmptyParagraph(markdown: string) {
  const body = markdown.replace(/\s+$/, '');
  return body
    ? `${body}\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`
    : TRAILING_EMPTY_PARAGRAPH_MARKDOWN;
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

  const afterSelection = range.cloneRange();
  afterSelection.selectNodeContents(element);
  afterSelection.setStart(range.endContainer, range.endOffset);
  return afterSelection.toString().length === 0 && !hasElementContentAfterRange(element, range);
}

function hasElementContentAfterRange(element: HTMLElement, range: Range) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
      if (node === element) return NodeFilter.FILTER_SKIP;
      if (!node.textContent?.trim() && node.childElementCount === 0) {
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
