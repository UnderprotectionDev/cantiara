const TABBABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], summary, [contenteditable="true"]';

export function scrollOwner(
  list: HTMLElement,
  horizontal: boolean,
): HTMLElement | null {
  for (let parent = list.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    if (
      (horizontal || !parent.hasAttribute("data-horizontal-scroll")) &&
      ["auto", "scroll", "overlay"].includes(overflow)
    ) {
      return parent;
    }
  }
  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : null;
}

export function isDocumentScroll(owner: HTMLElement) {
  return owner === document.scrollingElement;
}

export function rowTabStops(row: Element) {
  const descendants = [...row.querySelectorAll<HTMLElement>(TABBABLE)];
  if (row instanceof HTMLElement && row.matches(TABBABLE)) {
    descendants.unshift(row);
  }
  return descendants.filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden",
  );
}

export function directRow(list: HTMLElement, target: HTMLElement) {
  for (
    let row: HTMLElement | null = target;
    row && row !== list;
    row = row.parentElement
  ) {
    if (row.parentElement === list && row.hasAttribute("data-index")) {
      return row;
    }
  }
  return null;
}

export function nextRowTabTarget<Row>(
  list: HTMLElement,
  index: number,
  direction: number,
  rows: readonly Row[],
  isFocusable?: (row: Row) => boolean,
): { index: number; stop?: HTMLElement } | null {
  for (
    let next = index + direction;
    next >= 0 && next < rows.length;
    next += direction
  ) {
    const mounted = list.querySelector(`:scope > [data-index="${next}"]`);
    if (mounted) {
      const stops = rowTabStops(mounted);
      const stop = direction < 0 ? stops.at(-1) : stops[0];
      if (stop) {
        return { index: next, stop };
      }
    } else {
      const row = rows[next];
      if (row !== undefined && (isFocusable?.(row) ?? true)) {
        return { index: next };
      }
    }
  }
  return null;
}

export function outsideTabStop(list: HTMLElement, reverse: boolean) {
  const direction = reverse
    ? Node.DOCUMENT_POSITION_PRECEDING
    : Node.DOCUMENT_POSITION_FOLLOWING;
  const stops = rowTabStops(document.documentElement).filter(
    (element) =>
      !list.contains(element) &&
      // biome-ignore lint/suspicious/noBitwiseOperators: compareDocumentPosition returns a bitmask.
      Boolean(list.compareDocumentPosition(element) & direction),
  );
  return reverse ? stops.at(-1) : stops[0];
}

export const virtualRowId = (row: { id: string }) => row.id;
