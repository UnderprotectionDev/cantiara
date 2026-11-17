// @vitest-environment happy-dom
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import AddWorkForm from "../prioritization-session-add-work-form";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function mountAndSubmit(onAddWork: (workId: string) => Promise<unknown>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      createElement(AddWorkForm, {
        addableWorks: [{ id: "w1", key: "W-1", title: "Ship" } as WorkProfile],
        busy: false,
        onAddWork,
        sessionId: "s1",
      }),
    );
  });
  const select = host.querySelector("select") as HTMLSelectElement;
  act(() => {
    select.value = "w1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return select;
}

const SUBMIT_DISABLED =
  /<button(?=[^>]*disabled)(?=[^>]*type="submit")[^>]*>(Add Work|Save note)/;

describe("Prioritization session add Work form", () => {
  test("renders the labelled select, options and a disabled Add Work submit", () => {
    const html = renderToStaticMarkup(
      createElement(AddWorkForm, {
        addableWorks: [{ id: "w1", key: "W-1", title: "Ship" } as WorkProfile],
        busy: false,
        onAddWork: async () => undefined,
        sessionId: "s1",
      }),
    );
    expect(html).toContain("Work to add");
    expect(html).toContain('id="add-work-s1"');
    expect(html).toContain("Select Work");
    expect(html).toContain("W-1 Ship");
    expect(html).toMatch(SUBMIT_DISABLED);
  });

  test("clears the Work choice only after the add is saved", async () => {
    const onAddWork = vi.fn(async () => undefined);
    const select = await mountAndSubmit(onAddWork);
    expect(onAddWork).toHaveBeenCalledWith("w1");
    expect(select.value).toBe("");
  });

  test("keeps the Work choice when the add fails", async () => {
    const onAddWork = vi.fn(() => Promise.reject(new Error("offline")));
    const select = await mountAndSubmit(onAddWork);
    expect(onAddWork).toHaveBeenCalledWith("w1");
    expect(select.value).toBe("w1");
  });
});
