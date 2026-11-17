// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import WorkChecklist from "../work-checklist-form";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

describe("Work Checklists", () => {
  test("renders owned checklist item controls without Work lifecycle fields", () => {
    const html = renderToStaticMarkup(
      createElement(WorkChecklist, {
        checklist: [
          { completed: true, id: "item-1", text: "Confirm the copy" },
          { completed: false, id: "item-2", text: "Publish the page" },
        ],
        disabled: false,
        onConfirmConvert: vi.fn(),
        onPreviewConvert: vi.fn(),
        onSave: vi.fn(),
        workKey: "PAY-1",
      }),
    );

    expect(html).toContain("Checklist");
    expect(html).toContain("Confirm the copy");
    expect(html).toContain("Publish the page");
    expect(html).toContain("1 of 2 complete");
    expect(html).toContain("Add item");
    expect(html).toContain("Save item");
    expect(html).toContain("Move up");
    expect(html).toContain("Move down");
    expect(html).toContain("Delete item");
    for (const forbiddenField of [
      "Due date",
      "Priority",
      "Relation",
      "Status for item",
      "Test Scenario",
      "Handoff",
    ]) {
      expect(html).not.toContain(forbiddenField);
    }
  });

  test("keeps an empty checklist available without gating the parent Work", () => {
    const html = renderToStaticMarkup(
      createElement(WorkChecklist, {
        checklist: [],
        disabled: false,
        onConfirmConvert: vi.fn(),
        onPreviewConvert: vi.fn(),
        onSave: vi.fn(),
        workKey: "PAY-1",
      }),
    );

    expect(html).toContain("Add the first small step for this Work.");
    expect(html).toContain("New item for PAY-1");
  });

  test("replaces a converted item with a link to the independent Work", () => {
    const html = renderToStaticMarkup(
      createElement(WorkChecklist, {
        checklist: [
          {
            completed: true,
            convertedWork: {
              id: "work-2",
              key: "PAY-2",
              title: "Publish the page",
            },
            id: "item-1",
            text: "Publish the page",
          },
        ],
        disabled: false,
        onConfirmConvert: vi.fn(),
        onPreviewConvert: vi.fn(),
        onSave: vi.fn(),
        workKey: "PAY-1",
      }),
    );

    expect(html).toContain('href="#work-work-2"');
    expect(html).toContain("PAY-2 — Publish the page");
    expect(html).not.toContain("Mark Publish the page");
    expect(html).not.toContain("Convert to independent Work");
  });

  describe("saving a typed item edit", () => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    async function editAndSave(
      onSave: (checklist: unknown[]) => Promise<unknown>,
    ) {
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      act(() => {
        root.render(
          createElement(WorkChecklist, {
            checklist: [{ completed: false, id: "item-1", text: "Old text" }],
            disabled: false,
            onConfirmConvert: vi.fn(),
            onPreviewConvert: vi.fn(),
            onSave,
            workKey: "PAY-1",
          }),
        );
      });
      const input = host.querySelector(
        'input[aria-label="Item 1 for PAY-1"]',
      ) as HTMLInputElement;
      act(() => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(input, "New text");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        host
          .querySelector("form")
          ?.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const { value } = input;
      act(() => root.unmount());
      host.remove();
      return value;
    }

    test("Save item sends the validated resolved list", async () => {
      const onSave = vi.fn(async () => undefined);
      await editAndSave(onSave);
      expect(onSave).toHaveBeenCalledWith([
        { completed: false, id: "item-1", text: "New text" },
      ]);
    });

    test("a failed save keeps the typed text", async () => {
      const onSave = vi.fn(() => Promise.reject(new Error("failed")));
      const value = await editAndSave(onSave);
      expect(onSave).toHaveBeenCalledOnce();
      expect(value).toBe("New text");
    });
  });
});
