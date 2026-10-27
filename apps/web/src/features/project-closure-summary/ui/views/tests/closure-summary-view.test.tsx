// @vitest-environment happy-dom

import {
  type ClosureSummaryCandidate,
  type ClosureSummarySources,
  deriveClosureSummaryPreview,
  groupClosureSummaryCandidates,
} from "@cantiara/api/project-closure-summary";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ClosureSummaryView } from "../closure-summary-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const candidates: ClosureSummaryCandidate[] = [
  { label: "Use SQLite", recordId: "d1", recordType: "Decision" },
  { label: "TID-2 Offline queue", recordId: "w1", recordType: "Work" },
];

function sources(eligible = true): ClosureSummarySources {
  return {
    eligible,
    groups: eligible ? groupClosureSummaryCandidates(candidates) : [],
    projectId: "p1",
    projectStatus: eligible ? "Completed" : "Active",
  };
}

const onDraft = vi.fn((selected: { recordId: string; recordType: string }[]) =>
  Promise.resolve(
    deriveClosureSummaryPreview(
      "p1",
      candidates.filter((candidate) =>
        selected.some(
          (ref) =>
            ref.recordId === candidate.recordId &&
            ref.recordType === candidate.recordType,
        ),
      ),
    ),
  ),
);

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(ui));
  return host;
}

function button(view: HTMLElement, text: string) {
  const found = [...view.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text,
  );
  if (!found) {
    throw new Error(`No button ${text}`);
  }
  return found;
}

function click(element: HTMLElement) {
  return act(() => {
    element.click();
  });
}

function checkbox(view: HTMLElement, label: string) {
  const labelElement = [...view.querySelectorAll("label")].find(
    (candidate) => candidate.textContent === label,
  );
  const control = view.querySelector<HTMLElement>(
    `[id="${labelElement?.getAttribute("for")}"]`,
  );
  if (!control) {
    throw new Error(`No checkbox ${label}`);
  }
  return control;
}

function renderView() {
  return render(
    <ClosureSummaryView
      onDraft={onDraft as never}
      projectId="p1"
      sources={sources()}
    />,
  );
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  onDraft.mockClear();
});

test("shows the heading, the draft note and labelled source groups", () => {
  const rendered = renderView();
  expect(rendered.querySelector("h3")?.textContent).toBe(
    "Closure Summary Draft",
  );
  expect(rendered.textContent).toContain(
    "The draft contains only headings and links to your records. It writes no conclusions.",
  );
  expect(rendered.textContent).toContain("Select sources");
  expect(
    [...rendered.querySelectorAll("legend")].map((l) => l.textContent),
  ).toContain("Completed Work");
  // Every source is reachable through its visible label.
  expect(checkbox(rendered, "Use SQLite")).toBeTruthy();
});

test("previews which source lands under which heading", async () => {
  const rendered = renderView();
  await click(checkbox(rendered, "TID-2 Offline queue"));
  await click(button(rendered, "Preview headings"));
  const preview = rendered.querySelector("ul[aria-label='Heading preview']");
  expect(preview?.textContent).toBe("Completed WorkTID-2 Offline queue");
  expect(rendered.querySelector("textarea")).toBeNull();
});

test("generates an editable headings-and-links draft and discards it", async () => {
  const rendered = renderView();
  await click(checkbox(rendered, "Use SQLite"));
  await click(button(rendered, "Generate draft"));
  const editor = rendered.querySelector("textarea");
  expect(editor?.value).toBe(
    "## Decisions\n\n- [Use SQLite](/projects/p1#source-decision-d1)",
  );
  expect(rendered.textContent).not.toContain("Save as Document");

  await click(button(rendered, "Discard draft"));
  expect(rendered.querySelector("textarea")).toBeNull();
  expect(rendered.textContent).toContain("Select sources");
});

test("offers nothing on a Project that is not completed or abandoned", () => {
  const rendered = render(
    <ClosureSummaryView
      onDraft={onDraft as never}
      projectId="p1"
      sources={sources(false)}
    />,
  );
  expect(rendered.textContent).toBe("");
});
