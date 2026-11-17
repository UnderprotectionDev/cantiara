// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import type { ProjectWallCardView } from "@cantiara/api/project-wall";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import BindLinkForm from "../bind-link-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function card(index: number) {
  return {
    density: "Preview",
    fields: [],
    groupId: null,
    highlight: null,
    id: `card-${index}`,
    locked: false,
    placedAt: "2026-10-01T00:00:00.000Z",
    position: { x: index * 300, y: 0 },
    preview: null,
    sharedSource: false,
    source: {
      broken: null,
      kind: "Work",
      openPath: `/projects/p1#work-w${index}`,
      recordId: `w${index}`,
      status: "In Progress",
      title: `Record ${index}`,
    },
    sourceType: "Work",
  } satisfies ProjectWallCardView;
}

function typeInto(input: HTMLInputElement | null, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function bind(onDrawLink: () => Promise<boolean>) {
  act(() =>
    root.render(
      <BindLinkForm
        card={card(1)}
        cards={[card(1), card(2)]}
        onDrawLink={onDrawLink}
      />,
    ),
  );
  const select = container.querySelector("select");
  act(() => {
    if (select) {
      select.value = "card-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  typeInto(container.querySelector("input"), "depends on");
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Bind Visual link form", () => {
  test("keeps the label when the link was not persisted", async () => {
    await bind(() => Promise.resolve(false));
    expect(container.querySelector("input")?.value).toBe("depends on");
  });

  test("clears the label once the link is persisted", async () => {
    await bind(() => Promise.resolve(true));
    expect(container.querySelector("input")?.value).toBe("");
  });
});
