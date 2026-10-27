// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProjectUpdateForm } from "../project-update-form";

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

type Submit = ComponentProps<typeof ProjectUpdateForm>["onSubmit"];

function mount(onSubmit: Submit) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ProjectUpdateForm
        candidates={[
          {
            key: "Risk:r1",
            label: "Provider delay",
            status: "Open",
            type: "Risk",
          },
        ]}
        onSubmit={onSubmit}
      />,
    );
  });
}

function typeNarrative(value: string) {
  const area = host?.querySelector(
    "#project-update-narrative",
  ) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("Create Project Update form", () => {
  test("is a labelled form with the three marks, a narrative and a submit button", () => {
    mount(vi.fn<Submit>(async () => undefined));
    expect(
      host?.querySelector('form[aria-label="Create Project Update"]'),
    ).not.toBeNull();
    const labels = [...(host?.querySelectorAll("label") ?? [])].map((label) =>
      label.textContent?.trim(),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        "On Track",
        "At Risk",
        "Off Track",
        "Narrative",
        "Risk: Provider delay",
      ]),
    );
    expect(host?.querySelector('button[type="submit"]')?.textContent).toBe(
      "Create Project Update",
    );
  });

  test("sends the chosen mark, trimmed narrative and checked links", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(onSubmit);
    click("#project-update-mark-at-risk");
    typeNarrative("  Scope grew.  ");
    click("[id='project-update-link-Risk:r1']");
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      links: [{ targetId: "r1", targetType: "Risk" }],
      mark: "At Risk",
      narrative: "Scope grew.",
    });
  });

  test("refuses a save without a mark and shows an alert", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(onSubmit);
    typeNarrative("Only text");
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')).not.toBeNull();
  });
});
