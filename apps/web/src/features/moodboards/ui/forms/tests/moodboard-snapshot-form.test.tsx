// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SnapshotPanel } from "../moodboard-snapshot-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("Preview submits the chosen items through the Snapshot form", async () => {
  const preview = vi.fn();
  const api = {
    exportSnapshot: { isError: false, isPending: false, mutate: vi.fn() },
    snapshotPreview: { isError: false, isPending: false, mutate: preview },
  };
  const moodboard = {
    id: "m1",
    items: [
      { caption: "Hero", id: "i1", kind: "Visual", position: 0 },
      { color: "#fff", id: "i2", kind: "Swatch", position: 1 },
    ],
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <SnapshotPanel api={api as never} moodboard={moodboard as never} />,
    ),
  );
  const previewButton = [...host.querySelectorAll("button")].find(
    (item) => item.type === "submit",
  );
  expect(previewButton?.disabled).toBe(true);
  await act(() => {
    host.querySelector<HTMLElement>("#moodboard-snapshot-item-i2")?.click();
    return Promise.resolve();
  });
  await act(() => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });

  expect(preview).toHaveBeenCalledWith(
    { itemIds: ["i2"], moodboardId: "m1" },
    expect.any(Object),
  );
  await act(() => root.unmount());
  host.remove();
});
