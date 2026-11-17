// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The test renders the form with inline handlers.

import type { DecisionSupersessionGraph } from "@cantiara/api/decision-supersession";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { SupersessionSelectionForm } from "../supersession-selection-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const records: DecisionSupersessionGraph["records"] = [
  {
    createdAt: "2026-10-08T10:00:00.000Z",
    decision: "Small release",
    id: "old",
    life: "Valid",
    projectId: "project",
    rationale: "",
    revision: 1,
    sourceType: "Decision",
    title: "Original scope",
    updatedAt: "2026-10-08T10:00:00.000Z",
  },
];

function mount(onPreview: () => Promise<void>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <SupersessionSelectionForm
        onCancel={() => undefined}
        onPreview={onPreview}
        records={records}
        selection={{
          operation: "supersede",
          predecessorIds: [],
          projectId: "project",
          rationale: null,
          successorId: "new",
        }}
      />,
    );
  });
}

async function submit() {
  const form = host?.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
}

test("Supersession selection without a chosen Decision disables Preview and does not preview", async () => {
  const onPreview = vi.fn().mockResolvedValue(undefined);
  mount(onPreview);
  const preview = Array.from(host?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent === "Preview",
  );
  expect(preview?.disabled).toBe(true);
  await submit();
  expect(onPreview).not.toHaveBeenCalled();
  expect(host?.querySelector('[role="alert"]')).toBeNull();
});
