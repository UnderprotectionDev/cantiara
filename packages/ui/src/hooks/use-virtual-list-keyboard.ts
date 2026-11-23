import { useCreateStore, useSelector } from "@tanstack/react-store";
import {
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useLayoutEffect,
  useRef,
} from "react";

import {
  directRow,
  nextRowTabTarget,
  outsideTabStop,
  rowTabStops,
} from "../lib/virtual-list-dom";

export function useVirtualListKeyboard<Row>(
  listRef: RefObject<HTMLElement | null>,
  rows: readonly Row[],
  getKey: (row: Row) => string,
  isFocusable?: (row: Row) => boolean,
) {
  const focusedKey = useRef<string | null>(null);
  const keyboard = useCreateStore<{ index: number; reverse: boolean } | null>(
    null,
  );
  const pendingFocus = useSelector(keyboard);

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

  function handleBlur(event: FocusEvent<HTMLElement>) {
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
  }

  function handleFocus(event: FocusEvent<HTMLElement>) {
    if (listRef.current && event.target instanceof HTMLElement) {
      const row = directRow(listRef.current, event.target);
      const record = rows[Number(row?.dataset.index)];
      if (record !== undefined) {
        focusedKey.current = getKey(record);
      }
    }
  }

  return { focusedKey, handleBlur, handleFocus, handleTab, pendingFocus };
}
