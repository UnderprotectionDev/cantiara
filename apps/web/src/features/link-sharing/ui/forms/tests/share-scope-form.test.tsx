// @vitest-environment happy-dom
import type { ShareItem, ShareScopePreview } from "@cantiara/api/link-sharing";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ShareScopeForm } from "../share-scope-form";

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

type Submit = ComponentProps<typeof ShareScopeForm>["onSubmit"];

const item = (
  overrides: Partial<ShareItem> & { itemId: string },
): ShareItem => ({
  candidate: false,
  group: null,
  kind: "Field",
  label: overrides.itemId,
  leavesScope: false,
  live: false,
  liveEligible: false,
  parentId: "record:Work:w1",
  selectable: true,
  state: null,
  value: null,
  ...overrides,
});

const basePreview = (
  overrides: Partial<ShareScopePreview> = {},
): ShareScopePreview => ({
  blockers: [],
  diff: null,
  items: [
    item({
      itemId: "record:Work:w1",
      kind: "Record",
      label: "Work: Ship it",
      parentId: null,
    }),
    item({ itemId: "field:Work:w1:title", label: "Title", value: "Ship it" }),
    item({
      itemId: "field:Work:w1:status",
      label: "Status",
      liveEligible: true,
      value: "In Progress",
    }),
  ],
  placeholders: [],
  projectId: "p1",
  root: { id: "w1", kind: "Work", title: "Ship it" },
  surface: null,
  ...overrides,
});

function mount(preview: ShareScopePreview, onSubmit: Submit) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<ShareScopeForm onSubmit={onSubmit} preview={preview} />);
  });
}

function click(selector: string) {
  const element = host?.querySelector(selector) as HTMLElement;
  act(() => element.click());
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Approve scope form", () => {
  test("is a labelled form with one checkbox per item and the Approve scope button", () => {
    mount(
      basePreview(),
      vi.fn<Submit>(async () => undefined),
    );
    expect(
      host?.querySelector('form[aria-label="Approve scope"]'),
    ).not.toBeNull();
    const labels = [...(host?.querySelectorAll("label") ?? [])].map((label) =>
      label.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        "Work: Ship it",
        "TitleShip it",
        "StatusIn Progress",
      ]),
    );
    expect(host?.querySelector('button[type="submit"]')?.textContent).toBe(
      "Approve scope",
    );
  });

  test("offers Live only on an allow-listed field and sends the explicit selection", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(basePreview(), onSubmit);
    expect(
      host?.querySelector("[id='share-field-Work-w1-title-live']"),
    ).toBeNull();
    expect(
      host?.querySelector("[id='share-field-Work-w1-status-live']"),
    ).not.toBeNull();
    click("[id='share-field-Work-w1-status-live']");
    click("[id='share-field-Work-w1-title']");
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({
      approved: ["record:Work:w1", "field:Work:w1:status"],
      live: ["field:Work:w1:status"],
      publishAnyway: false,
    });
  });

  test("shows Publish/share anyway only with placeholders and keeps it separate from scope", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(basePreview(), onSubmit);
    expect(host?.querySelector("#share-publish-anyway")).toBeNull();
    act(() => root?.unmount());
    host?.remove();
    mount(
      basePreview({
        placeholders: [
          {
            context: "Hi {{alan_adı}}",
            fieldKey: "body",
            fieldLabel: "Body",
            itemId: "field:Work:w1:title",
            placeholder: "{{alan_adı}}",
            recordId: "w1",
            recordKind: "Work",
            recordTitle: "Ship it",
          },
        ],
      }),
      onSubmit,
    );
    expect(host?.textContent).toContain("Publish/share anyway");
    await submit();
    expect(onSubmit.mock.calls[0]?.[0].publishAnyway).toBe(false);
    click("#share-publish-anyway");
    await submit();
    expect(onSubmit.mock.calls[1]?.[0].publishAnyway).toBe(true);
  });

  test("refuses a submit while an exact version is not chosen", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(
      basePreview({
        items: [
          item({
            itemId: "record:Work:w1",
            kind: "Record",
            label: "Work: Ship it",
            parentId: null,
          }),
          item({
            group: "Wireframe version",
            itemId: "part:v1",
            kind: "Version",
            label: "Wireframe version 1",
          }),
        ],
      }),
      onSubmit,
    );
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')?.textContent).toContain(
      "Wireframe version",
    );
  });
});
