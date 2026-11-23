import { useCreateStore, useSelector } from "@tanstack/react-store";
import { type RefObject, useLayoutEffect } from "react";
import { isDocumentScroll, scrollOwner } from "../lib/virtual-list-dom";

export function useVirtualListGeometry(
  listRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  horizontal: boolean,
) {
  const viewport = useCreateStore<{
    owner: HTMLElement;
    margin: number;
    inlineStart: number;
    inlineEnd: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    const list = listRef.current;
    const owner = list && scrollOwner(list, horizontal);
    if (!(list && owner)) {
      return;
    }
    const scrollTarget = isDocumentScroll(owner) ? window : owner;
    const updateGeometry = () => {
      const rect = list.getBoundingClientRect();
      const ownerRect = owner.getBoundingClientRect();
      const documentOwner = isDocumentScroll(owner);
      const margin = horizontal
        ? rect.left +
          owner.scrollLeft -
          (documentOwner ? 0 : ownerRect.left + owner.clientLeft)
        : rect.top +
          owner.scrollTop -
          (documentOwner ? 0 : ownerRect.top + owner.clientTop);
      const style = getComputedStyle(list);
      const inlineStart = Number.parseFloat(style.paddingInlineStart) || 0;
      const inlineEnd = Number.parseFloat(style.paddingInlineEnd) || 0;
      viewport.setState((current) =>
        current?.margin === margin &&
        current.owner === owner &&
        current.inlineStart === inlineStart &&
        current.inlineEnd === inlineEnd
          ? current
          : { inlineEnd, inlineStart, margin, owner },
      );
    };
    const observer = new ResizeObserver(updateGeometry);
    // Changes above the list (headers, disclosures, preceding lists) can move
    // its origin independently of the height of the scroll viewport.
    for (
      let element: HTMLElement | null = list;
      element && element !== owner;
      element = element.parentElement
    ) {
      observer.observe(element);
      for (
        let sibling = element.previousElementSibling;
        sibling;
        sibling = sibling.previousElementSibling
      ) {
        observer.observe(sibling);
      }
    }
    observer.observe(owner);
    updateGeometry();
    scrollTarget.addEventListener("scroll", updateGeometry, { passive: true });
    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", updateGeometry);
    };
  }, [enabled, horizontal, listRef, viewport]);

  return useSelector(viewport);
}
