// biome-ignore-all lint/performance/noJsxPropsBind: Each mounted row binds its own measurement and identity.
"use client";

import { useCreateStore, useSelector } from "@tanstack/react-store";
import {
  defaultRangeExtractor,
  observeElementOffset,
  observeElementRect,
  useVirtualizer,
} from "@tanstack/react-virtual";
import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import {
  directRow,
  isDocumentScroll,
  nextRowTabTarget,
  outsideTabStop,
  rowTabStops,
  scrollOwner,
} from "../lib/virtual-list-dom";

const MIN_VIRTUAL_ROWS = 30;
const OVERSCAN = 8;
export interface VirtualRowProps {
  "aria-posinset"?: number;
  "aria-rowindex"?: number;
  "aria-setsize"?: number;
  "data-index"?: number;
  ref?: RefCallback<HTMLElement>;
  style?: CSSProperties;
}

export const virtualRowId = (row: { id: string }) => row.id;

type ListTag = "div" | "ul" | "ol" | "tbody";

export interface VirtualListReveal {
  elementId: string;
  key: string;
}

interface VirtualListProps<Row>
  extends Pick<
    ComponentPropsWithoutRef<"div">,
    "aria-label" | "aria-labelledby" | "className"
  > {
  as?: ListTag;
  children: (row: Row, props: VirtualRowProps, index: number) => ReactNode;
  columns?: number;
  empty?: ReactNode;
  estimateSize?: number;
  gap?: number;
  getKey: (row: Row) => string;
  horizontal?: boolean;
  isFocusable?: (row: Row) => boolean;
  keepMounted?: readonly string[];
  reveal?: VirtualListReveal;
  rows: readonly Row[];
  scrollToKey?: string | null;
}

export function VirtualList<Row>({
  "aria-label": label,
  "aria-labelledby": labelledBy,
  as: Tag = "ul",
  children,
  className,
  columns,
  empty,
  estimateSize = 48,
  gap = 0,
  getKey,
  horizontal = false,
  isFocusable,
  keepMounted,
  reveal,
  rows,
  scrollToKey,
}: VirtualListProps<Row>) {
  const listRef = useRef<HTMLElement | null>(null);
  const viewport = useCreateStore<{
    owner: HTMLElement;
    margin: number;
    inlineStart: number;
    inlineEnd: number;
  } | null>(null);
  const geometry = useSelector(viewport);
  const focusedKey = useRef<string | null>(null);
  const keyboard = useCreateStore<{ index: number; reverse: boolean } | null>(
    null,
  );
  const pendingFocus = useSelector(keyboard);
  const handledReveal = useRef<VirtualListReveal | undefined>(undefined);
  const lastScrollKey = useRef<string | null>(null);
  const isTable = Tag === "tbody";
  const isList = Tag === "ul" || Tag === "ol";

  const indexByKey = useMemo(
    () => new Map(rows.map((row, index) => [getKey(row), index])),
    [getKey, rows],
  );
  const getItemKey = useCallback(
    (index: number) => {
      const row = rows[index];
      return row === undefined ? index : getKey(row);
    },
    [getKey, rows],
  );
  const setList = useCallback((element: HTMLElement | null) => {
    listRef.current = element;
  }, []);
  const enabled = rows.length >= MIN_VIRTUAL_ROWS;

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
    function updateGeometry() {
      if (!(list && owner)) {
        return;
      }
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
    }
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
  }, [enabled, horizontal, viewport]);

  const scrollMargin = geometry?.margin ?? 0;
  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled,
    horizontal,
    observeElementOffset: (instance, callback) => {
      const owner = instance.scrollElement;
      if (!(owner && isDocumentScroll(owner))) {
        return observeElementOffset(instance, callback);
      }
      const onScroll = () =>
        callback(horizontal ? window.scrollX : window.scrollY, false);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    },
    observeElementRect: (instance, callback) => {
      const owner = instance.scrollElement;
      if (!(owner && isDocumentScroll(owner))) {
        return observeElementRect(instance, callback);
      }
      const onResize = () =>
        callback({ height: owner.clientHeight, width: owner.clientWidth });
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    },
    estimateSize: () => estimateSize,
    gap,
    getItemKey,
    getScrollElement: () => geometry?.owner ?? null,
    overscan: OVERSCAN,
    rangeExtractor: (range) => {
      const indexes = new Set(defaultRangeExtractor(range));
      for (const key of [
        focusedKey.current,
        reveal?.key,
        ...(keepMounted ?? []),
      ]) {
        if (key) {
          const index = indexByKey.get(key);
          if (index !== undefined) {
            indexes.add(index);
          }
        }
      }
      if (pendingFocus && pendingFocus.index < rows.length) {
        indexes.add(pendingFocus.index);
      }
      return [...indexes].sort((a, b) => a - b);
    },
    scrollMargin,
    useFlushSync: false,
  });

  useLayoutEffect(() => {
    if (!(enabled && scrollToKey)) {
      lastScrollKey.current = null;
      return;
    }
    if (!geometry || lastScrollKey.current === scrollToKey) {
      return;
    }
    const index = indexByKey.get(scrollToKey);
    if (index !== undefined) {
      lastScrollKey.current = scrollToKey;
      virtualizer.scrollToIndex(index, { align: "start" });
    }
  }, [enabled, geometry, indexByKey, scrollToKey, virtualizer]);

  useLayoutEffect(() => {
    if (reveal && handledReveal.current !== reveal) {
      const target = document.getElementById(reveal.elementId);
      if (target && listRef.current?.contains(target)) {
        handledReveal.current = reveal;
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
      }
    }
  });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!(pendingFocus && list)) {
      return;
    }
    const { index, reverse } = pendingFocus;
    const row = list.querySelector(`:scope > [data-index="${index}"]`);
    if (!row) {
      return;
    }
    const stop = rowTabStops(row).at(reverse ? -1 : 0);
    if (stop) {
      keyboard.setState(() => null);
      stop.focus();
      return;
    }
    const next = nextRowTabTarget(
      list,
      index,
      reverse ? -1 : 1,
      rows,
      isFocusable,
    );
    if (next && !next.stop) {
      const frame = requestAnimationFrame(() =>
        keyboard.setState(() => ({ index: next.index, reverse })),
      );
      return () => cancelAnimationFrame(frame);
    }
    const destination = next?.stop ?? outsideTabStop(list, reverse);
    keyboard.setState(() => null);
    destination?.focus();
  });

  function handleTab(event: KeyboardEvent<HTMLElement>) {
    if (
      event.key !== "Tab" ||
      event.defaultPrevented ||
      !(event.target instanceof HTMLElement)
    ) {
      return;
    }
    const list = listRef.current;
    const row = list && directRow(list, event.target);
    if (!(list && row)) {
      return;
    }
    const reverse = event.shiftKey;
    const stops = rowTabStops(row);
    if (event.target !== (reverse ? stops[0] : stops.at(-1))) {
      return;
    }
    const next = nextRowTabTarget(
      list,
      Number(row.dataset.index),
      reverse ? -1 : 1,
      rows,
      isFocusable,
    );
    if (!next || next.stop) {
      return;
    }
    event.preventDefault();
    keyboard.setState(() => ({ index: next.index, reverse }));
  }

  const virtualItems = virtualizer.getVirtualItems();
  // The first paint and non-layout renderers can display a small initial
  // window while the scroll owner is still waiting to report its dimensions.
  const items = virtualItems.length
    ? virtualItems
    : Array.from(
        { length: enabled ? Math.min(OVERSCAN, rows.length) : rows.length },
        (_, index) => {
          const start = scrollMargin + index * (estimateSize + gap);
          return { end: start + estimateSize, index, start };
        },
      );
  const size = virtualizer.getTotalSize();
  const inlineStart = geometry?.inlineStart ?? 0;
  const inlineSize = `calc(100% - ${inlineStart + (geometry?.inlineEnd ?? 0)}px)`;
  let previousEnd = scrollMargin;
  const useSpacers = enabled && (isTable || horizontal);
  const windowStyle: CSSProperties = horizontal
    ? { alignItems: "start", display: "flex", width: size, gap: 0 }
    : { height: size, position: "relative" };
  const listStyle = enabled && !isTable ? windowStyle : undefined;
  const Spacer = isList ? "li" : "div";

  function spacer(length: number) {
    if (!useSpacers || length <= 0) {
      return null;
    }
    return horizontal ? (
      <Spacer aria-hidden="true" style={{ flex: `0 0 ${length}px` }} />
    ) : (
      <TableSpacer columns={columns} height={length} />
    );
  }

  function rowStyle(start: number, end: number): CSSProperties | undefined {
    if (isTable) {
      return;
    }
    if (horizontal) {
      return { flex: `0 0 ${end - start}px`, margin: 0 };
    }
    return {
      insetInlineStart: inlineStart,
      marginBlock: 0,
      position: "absolute",
      top: start - scrollMargin,
      width: inlineSize,
    };
  }

  return (
    <Tag
      aria-label={label}
      aria-labelledby={labelledBy}
      className={className}
      onBlur={(event) => {
        const target = event.relatedTarget;
        if (
          target instanceof Element &&
          !event.currentTarget.contains(target) &&
          !target.closest(
            '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
          )
        ) {
          focusedKey.current = null;
        }
      }}
      onFocus={(event) => {
        if (listRef.current && event.target instanceof HTMLElement) {
          const row = directRow(listRef.current, event.target);
          const record = rows[Number(row?.dataset.index)];
          if (record !== undefined) {
            focusedKey.current = getKey(record);
          }
        }
      }}
      onKeyDown={handleTab}
      ref={setList}
      role={enabled && isList ? "list" : undefined}
      style={listStyle}
    >
      {rows.length === 0 ? empty : null}
      {items.map(({ end, index, start }) => {
        const row = rows[index];
        if (row === undefined) {
          return null;
        }
        const space = start - previousEnd;
        previousEnd = end;
        const props: VirtualRowProps = enabled
          ? {
              "aria-posinset": isList ? index + 1 : undefined,
              "aria-rowindex": isTable ? index + 2 : undefined,
              "aria-setsize": isList ? rows.length : undefined,
              "data-index": index,
              ref: virtualizer.measureElement,
              style: rowStyle(start, end),
            }
          : { "data-index": index };
        return (
          <Fragment key={getKey(row)}>
            {spacer(space)}
            {children(row, props, index)}
          </Fragment>
        );
      })}
      {spacer(size - previousEnd + scrollMargin)}
    </Tag>
  );
}

function TableSpacer({
  columns,
  height,
}: {
  columns?: number;
  height: number;
}) {
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: A spacer row has no keyboard controls or table content.
    <tr aria-hidden="true">
      <td colSpan={columns} style={{ height, padding: 0 }} />
    </tr>
  );
}
