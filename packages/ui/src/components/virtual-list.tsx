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
  type ReactNode,
  type RefCallback,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { RowRetentionContext } from "../hooks/use-retain-virtual-row";
import { useVirtualListGeometry } from "../hooks/use-virtual-list-geometry";
import { useVirtualListKeyboard } from "../hooks/use-virtual-list-keyboard";
import { isDocumentScroll } from "../lib/virtual-list-dom";

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

type ListTag = "div" | "ul" | "ol" | "tbody";

function RetainedRow({
  children,
  rowKey,
  retainKey,
}: {
  children: ReactNode;
  rowKey: string;
  retainKey: (key: string) => () => void;
}) {
  const retainParent = useContext(RowRetentionContext);
  const retain = useCallback(() => {
    const releaseRow = retainKey(rowKey);
    const releaseParent = retainParent?.();
    return () => {
      releaseRow();
      releaseParent?.();
    };
  }, [retainKey, retainParent, rowKey]);
  return (
    <RowRetentionContext.Provider value={retain}>
      {children}
    </RowRetentionContext.Provider>
  );
}

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
  const { focusedKey, handleBlur, handleFocus, handleTab, pendingFocus } =
    useVirtualListKeyboard(listRef, rows, getKey, isFocusable);
  const retention = useCreateStore<ReadonlyMap<string, number>>(
    new Map<string, number>(),
  );
  const retainedKeys = useSelector(retention);
  const retainKey = useCallback(
    (key: string) => {
      retention.setState((current) =>
        new Map(current).set(key, (current.get(key) ?? 0) + 1),
      );
      return () => {
        retention.setState((current) => {
          const next = new Map(current);
          const count = next.get(key) ?? 0;
          if (count > 1) {
            next.set(key, count - 1);
          } else {
            next.delete(key);
          }
          return next;
        });
      };
    },
    [retention],
  );
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

  const geometry = useVirtualListGeometry(listRef, enabled, horizontal);
  const scrollMargin = geometry?.margin ?? 0;
  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled,
    horizontal,
    observeElementOffset: (instance, callback) => {
      const owner = instance.scrollElement;
      if (!owner) {
        return;
      }
      // A nested list can mount after its shared scroll owner has already
      // moved. Seed the offset before the virtualizer's first scroll write.
      const reportOffset = () =>
        callback(horizontal ? owner.scrollLeft : owner.scrollTop, false);
      reportOffset();
      if (!isDocumentScroll(owner)) {
        return observeElementOffset(instance, callback);
      }
      window.addEventListener("scroll", reportOffset, { passive: true });
      return () => window.removeEventListener("scroll", reportOffset);
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
        ...retainedKeys.keys(),
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

  const items = virtualizer.getVirtualItems();
  const windowItems = items.length
    ? items
    : initialWindow(rows.length, estimateSize, gap, scrollMargin);
  const size = virtualizer.getTotalSize();
  const inlineStart = geometry?.inlineStart ?? 0;
  const inlineSize = `calc(100% - ${inlineStart + (geometry?.inlineEnd ?? 0)}px)`;
  let previousEnd = scrollMargin;
  const useSpacers = enabled && (isTable || horizontal);
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
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleTab}
      ref={setList}
      role={enabled && isList ? "list" : undefined}
      style={virtualListStyle(size, enabled && !isTable, horizontal)}
    >
      {rows.length === 0 ? empty : null}
      {windowItems.map(({ end, index, start }) => {
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
        const rowKey = getKey(row);
        return (
          <Fragment key={rowKey}>
            {spacer(space)}
            <RetainedRow retainKey={retainKey} rowKey={rowKey}>
              {children(row, props, index)}
            </RetainedRow>
          </Fragment>
        );
      })}
      {spacer(size - previousEnd + scrollMargin)}
    </Tag>
  );
}

function initialWindow(
  count: number,
  estimateSize: number,
  gap: number,
  scrollMargin: number,
) {
  // The first paint and non-layout renderers can display a small initial
  // window while the scroll owner is still waiting to report its dimensions.
  const length = count >= MIN_VIRTUAL_ROWS ? Math.min(OVERSCAN, count) : count;
  return Array.from({ length }, (_, index) => {
    const start = scrollMargin + index * (estimateSize + gap);
    return { end: start + estimateSize, index, start };
  });
}

function virtualListStyle(
  size: number,
  windowed: boolean,
  horizontal: boolean,
): CSSProperties | undefined {
  if (!windowed) {
    return;
  }
  return horizontal
    ? { alignItems: "start", display: "flex", width: size, gap: 0 }
    : { height: size, position: "relative" };
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
