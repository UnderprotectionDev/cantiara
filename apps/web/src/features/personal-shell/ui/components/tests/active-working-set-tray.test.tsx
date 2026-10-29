// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  addToActiveWorkingSet,
  endActiveWorkingSetSession,
} from "../../../store/active-working-set";
import ActiveWorkingSetTray from "../active-working-set-tray";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  endActiveWorkingSetSession();
});

function mount(open: () => void) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<ActiveWorkingSetTray open={open} />));
}

function button(name: string) {
  return [...document.querySelectorAll<HTMLElement>("button")].find((item) =>
    item.textContent?.includes(name),
  );
}

test("renders nothing while the set is empty", () => {
  mount(vi.fn());
  expect(host?.textContent).toBe("");
});

test("holds members, reopens one in a single action, collapses and shows again", () => {
  const open = vi.fn();
  addToActiveWorkingSet({
    id: "w1",
    kind: "Work",
    label: "CAN-1 Ship it",
    projectId: "p1",
  });
  mount(open);
  expect(host?.textContent).toContain("Active Working Set (1)");
  expect(host?.textContent).toContain("Held for this session only.");
  act(() => button("CAN-1 Ship it")?.click());
  expect(open).toHaveBeenCalledExactlyOnceWith({
    kind: "work",
    label: "CAN-1 Ship it",
    projectId: "p1",
    workId: "w1",
  });
  act(() => button("Collapse")?.click());
  expect(button("CAN-1 Ship it")).toBeUndefined();
  act(() => button("Show tray")?.click());
  expect(button("CAN-1 Ship it")).toBeDefined();
});
