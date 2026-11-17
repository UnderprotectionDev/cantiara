// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The test renders the form with inline handlers.

import type { ProjectGoalDetail } from "@cantiara/api/project-goals";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ProjectGoalRelationForm } from "../project-goal-relation-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const detail = {
  candidates: [
    { recordId: "w1", recordType: "Work", title: "Checkout", workType: "Task" },
  ],
  relations: [],
} as unknown as ProjectGoalDetail;

function mount(onAdd: () => Promise<unknown>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ProjectGoalRelationForm
        detail={detail}
        onAdd={onAdd}
        pending={false}
        settledChanges={0}
      />,
    );
  });
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

test("Add contribution without a chosen Record does not add", async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  mount(onAdd);
  await submit();
  expect(onAdd).not.toHaveBeenCalled();
});

test("Add contribution with a chosen Record adds exactly that Record", async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  mount(onAdd);
  const record = host?.querySelector<HTMLSelectElement>(
    "#goal-relation-record",
  );
  await act(async () => {
    if (record) {
      record.value = JSON.stringify(["Work", "w1"]);
      record.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await Promise.resolve();
  });
  await submit();
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(onAdd.mock.calls[0]?.[0]).toMatchObject({
    attached: true,
    kind: "Contributes to Goal",
  });
});
