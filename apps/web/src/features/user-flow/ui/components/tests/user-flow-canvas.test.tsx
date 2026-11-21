// @vitest-environment happy-dom
import type { UserFlowView } from "@cantiara/api/user-flow";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const gestures = vi.hoisted(() => ({
  move: undefined as
    | ((event: null, viewport: { x: number; y: number; zoom: number }) => void)
    | undefined,
}));

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ReactFlow: ({ onMoveEnd }: { onMoveEnd: typeof gestures.move }) => {
    gestures.move = onMoveEnd;
    return null;
  },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  useReactFlow: () => ({}),
}));

import UserFlowCanvas from "../user-flow-canvas";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const flow: UserFlowView = {
  cards: [],
  createdAt: "2026-10-01T09:00:00.000Z",
  id: "flow-1",
  links: [],
  nodes: [],
  projectId: "project-1",
  title: "Purchase path",
  updatedAt: "2026-10-01T09:00:00.000Z",
  version: 1,
};

let root: Root;
let host: HTMLDivElement;
const save = vi.fn();
const saveContent = vi.fn();

function pan(x: number, y: number, zoom: number) {
  const { move } = gestures;
  if (!move) {
    throw new Error("User Flow canvas is not ready for movement");
  }
  act(() => move(null, { x, y, zoom }));
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
  saveContent.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <UserFlowCanvas
        flow={flow}
        onSave={saveContent}
        onViewportChange={save}
      />,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

test("coalesces canvas movement into the last personal viewport without saving content", async () => {
  pan(0, 0, 1);
  pan(200, 80, 2);
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(save).toHaveBeenCalledExactlyOnceWith({
    center: { x: 100, y: 50 },
    collapsed: [],
    zoom: 2,
  });
  expect(saveContent).not.toHaveBeenCalled();
});

test("leaving the canvas flushes its last personal viewport exactly once", async () => {
  pan(200, 80, 2);
  await act(async () => root.unmount());
  expect(save).toHaveBeenCalledExactlyOnceWith({
    center: { x: 100, y: 50 },
    collapsed: [],
    zoom: 2,
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  expect(saveContent).not.toHaveBeenCalled();
  root = createRoot(host);
});

test("the User Flow inspector reads text only from the currently selected node", async () => {
  saveContent.mockResolvedValue(undefined);
  const nodes = [
    {
      id: "checkout",
      kind: "Action",
      placedAt: flow.createdAt,
      position: { x: 0, y: 0 },
      screen: null,
      sectionId: null,
      style: "default",
      text: "Checkout",
    },
    {
      id: "confirm",
      kind: "Action",
      placedAt: flow.createdAt,
      position: { x: 0, y: 200 },
      screen: null,
      sectionId: null,
      style: "default",
      text: "Confirm order",
    },
  ] satisfies UserFlowView["nodes"];
  act(() =>
    root.render(
      <UserFlowCanvas
        flow={{ ...flow, nodes, version: 2 }}
        onSave={saveContent}
        onViewportChange={save}
      />,
    ),
  );
  const text = () =>
    host.querySelector<HTMLTextAreaElement>("#user-flow-selected-text");
  function select(label: string) {
    const button = host.querySelector<HTMLButtonElement>(
      `[aria-label="Select Action: ${label}"]`,
    );
    expect(button).not.toBeNull();
    act(() => button?.click());
  }
  select("Checkout");
  const previous = text();
  expect(previous?.value).toBe("Checkout");
  if (!previous) {
    throw new Error("No selected node inspector");
  }
  previous.value = "Old draft";
  select("Checkout");
  select("Confirm order");
  expect(text()?.value).toBe("Confirm order");
  act(() =>
    previous.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  expect(saveContent).not.toHaveBeenCalled();

  const current = text();
  if (!current) {
    throw new Error("No replacement node inspector");
  }
  current.value = "Confirm payment";
  act(() =>
    current.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  const saveVersion = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Save version",
  );
  expect(saveVersion?.disabled).toBe(false);
  await act(() => {
    saveVersion?.click();
    return Promise.resolve();
  });
  expect(saveContent).toHaveBeenCalledOnce();
  expect(JSON.stringify(saveContent.mock.calls[0])).toContain(
    "Confirm payment",
  );
  expect(JSON.stringify(saveContent.mock.calls[0])).not.toContain("Old draft");
});
