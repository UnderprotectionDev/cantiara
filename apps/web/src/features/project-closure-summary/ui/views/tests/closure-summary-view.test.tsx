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

const onSave = vi.fn((input: { title: string }) =>
  Promise.resolve({ id: "doc-1", title: input.title }),
);
const identityFormatDate = (value: string) => value;
const onDateHistory = vi.fn(() =>
  Promise.resolve({
    note: "This is a reading of existing history. It is not a score." as const,
    projectId: "p1",
    rows: [
      {
        closedOn: "2026-10-12",
        label: "TID-2 Offline queue",
        moved: true,
        plannedDates: ["2026-10-01", "2026-10-10"],
        reading: "After target" as const,
        recordId: "w1",
        recordType: "Work" as const,
      },
    ],
  }),
);

function renderView() {
  return render(
    <ClosureSummaryView
      formatDate={identityFormatDate}
      onDateHistory={onDateHistory as never}
      onDraft={onDraft as never}
      onSave={onSave as never}
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
  onSave.mockClear();
  onDateHistory.mockClear();
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
  // Generating is not saving: nothing was written.
  expect(onSave).not.toHaveBeenCalled();

  await click(button(rendered, "Discard draft"));
  expect(rendered.querySelector("textarea")).toBeNull();
  expect(rendered.textContent).toContain("Select sources");
  expect(onSave).not.toHaveBeenCalled();
});

test("Save as Document writes once with the default title and shows the Document", async () => {
  const rendered = renderView();
  await click(checkbox(rendered, "Use SQLite"));
  await click(button(rendered, "Generate draft"));
  const title = rendered.querySelector<HTMLInputElement>("input");
  expect(title?.value).toBe("Project Closure Summary");
  await click(button(rendered, "Save as Document"));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave.mock.calls[0]?.[0]).toMatchObject({
    body: "## Decisions\n\n- [Use SQLite](/projects/p1#source-decision-d1)",
    title: "Project Closure Summary",
  });
  expect(rendered.textContent).toContain(
    "Project Closure Summary saved as a Document.",
  );
  expect(rendered.querySelector("a")?.getAttribute("href")).toContain("doc-1");
});

test("the optional Planned date history is a neutral reading with no score", async () => {
  const rendered = renderView();
  await click(checkbox(rendered, "TID-2 Offline queue"));
  await click(button(rendered, "Generate draft"));
  expect(rendered.textContent).not.toContain("It is not a score.");
  await click(button(rendered, "Planned date history"));
  const text = rendered.querySelector(
    "section[aria-label='Planned date history']",
  )?.textContent;
  expect(text).toContain(
    "This is a reading of existing history. It is not a score.",
  );
  expect(text).toContain("2026-10-01 → 2026-10-10. Moved");
  expect(text).toContain("After target (2026-10-12)");
  expect(onSave).not.toHaveBeenCalled();
});

test("Planned date history is not offered without a Work source", async () => {
  const rendered = renderView();
  await click(checkbox(rendered, "Use SQLite"));
  await click(button(rendered, "Generate draft"));
  expect(
    [...rendered.querySelectorAll("button")].some(
      (candidate) => candidate.textContent === "Planned date history",
    ),
  ).toBe(false);
});

test("offers nothing on a Project that is not completed or abandoned", () => {
  const rendered = render(
    <ClosureSummaryView
      formatDate={identityFormatDate}
      onDateHistory={onDateHistory as never}
      onDraft={onDraft as never}
      onSave={onSave as never}
      projectId="p1"
      sources={sources(false)}
    />,
  );
  expect(rendered.textContent).toBe("");
});
