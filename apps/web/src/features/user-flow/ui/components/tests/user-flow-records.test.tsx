// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const presenter = vi.hoisted(() => ({
  presentSupportReferenceFailure: vi.fn(),
}));
vi.mock(
  "@/features/web-macos-client/ui/components/support-reference",
  () => presenter,
);

import { LiveCardList } from "../user-flow-records";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
  act(() => root.unmount());
  container.remove();
});

const cards = [
  {
    id: "card-1",
    placedAt: "2026-10-01T00:00:00.000Z",
    position: { x: 0, y: 0 },
    record: {
      broken: null,
      kind: "Work" as const,
      openPath: null,
      recordId: "w1",
      status: "In Progress",
      title: "Ship it",
    },
  },
];

describe("Live cards Remove card", () => {
  test("presents a failed removal through the shell presenter instead of leaving an unhandled rejection", async () => {
    act(() =>
      root.render(
        <LiveCardList
          cards={cards}
          onRemove={() => Promise.reject(new Error("The User Flow changed."))}
          readOnly={false}
        />,
      ),
    );
    await act(async () => {
      container.querySelector("button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(presenter.presentSupportReferenceFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: "The User Flow changed." }),
      expect.objectContaining({ kind: "mutation" }),
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(unhandled).toEqual([]);
  });
});
