// @vitest-environment happy-dom

import type { AssumptionRecord } from "@cantiara/api/uncertainty-records";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { ProjectAssumptionsView } from "../project-assumptions-panel";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const record: AssumptionRecord = {
  id: "a1",
  projectId: "p1",
  title: "Export demand",
  statement: "Customers need export.",
  rationale: null,
  life: "Confirmed",
  revision: 1,
  sourceType: "Assumption",
  createdAt: "2026-10-09T10:00:00Z",
  updatedAt: "2026-10-09T10:00:00Z",
};
const save = async () => undefined;

test("selection preserves a new Assumption draft and detaches an older record save", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const pending = Promise.withResolvers<void>();
  const onSave = vi.fn(() => pending.promise);
  const next = { ...record, id: "a2", title: "Second Assumption" };
  const context = { records: [record, next], evidence: [], readOnly: false };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(selectedId: string) {
    act(() =>
      root.render(
        <ProjectAssumptionsView
          context={context}
          onSave={onSave}
          onTransition={save}
          projectId={record.projectId}
          selectedId={selectedId}
        />,
      ),
    );
  }
  function button(label: string) {
    return [...host.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    );
  }
  function click(label: string) {
    const control = button(label);
    expect(control?.disabled).toBe(false);
    act(() => control?.click());
  }
  const title = () => host.querySelector<HTMLInputElement>("#assumption-title");
  try {
    render(record.id);
    click("Create");
    act(() => {
      const input = title();
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "New unlinked draft");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    render(next.id);
    expect(title()?.value).toBe("New unlinked draft");
    click("Cancel");

    render(record.id);
    click("Edit");
    const form = host.querySelector("form");
    expect(form).not.toBeNull();
    await act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      return Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.anything(), record);
    expect(button("Cancel")?.disabled).toBe(true);
    render(next.id);
    expect(title()).toBeNull();
    click("Edit");
    await act(async () => pending.resolve());
    expect(title()?.value).toBe(next.title);
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
test("Uncertainty Records shows missing evidence without a transition gate or future review queue", () => {
  const html = renderToStaticMarkup(
    <ProjectAssumptionsView
      context={{ records: [record], evidence: [], readOnly: false }}
      onSave={save}
      onTransition={save}
      projectId="p1"
      selectedId="a1"
    />,
  );
  expect(html).toContain("No evidence linked.");
  expect(html).toContain(">Refuted</button>");
  expect(html).toContain(">No longer applicable</button>");
  expect(html).not.toContain("Based on");
  expect(html).not.toContain("Refuted Assumption Review");
});
test("Uncertainty Records preserves exact evidence on No longer applicable and hides writes when archived", () => {
  const html = renderToStaticMarkup(
    <ProjectAssumptionsView
      context={{
        records: [{ ...record, life: "No longer applicable" }],
        readOnly: true,
        evidence: [
          {
            id: "e1",
            assumptionId: "a1",
            documentId: "d1",
            revision: 2,
            title: "Interview",
            excerpt: "Demand confirmed",
          },
        ],
      }}
      onSave={save}
      onTransition={save}
      projectId="p1"
      selectedId="a1"
    />,
  );
  expect(html).toContain("Demand confirmed");
  expect(html).toContain("Version 2");
  expect(html).not.toContain(">Create</button>");
  expect(html).not.toContain(">Edit</button>");
});
