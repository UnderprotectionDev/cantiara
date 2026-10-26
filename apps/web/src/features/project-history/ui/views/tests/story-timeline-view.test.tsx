// @vitest-environment happy-dom

import {
  deriveStoryTimeline,
  type StoryEventFact,
  type StoryTimelineFacts,
} from "@cantiara/api/project-history";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { StoryTimelineView } from "../story-timeline-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SIGNAL_OR_NARRATIVE =
  /signal|notification|closure summary|release note|public|success|congratulations/i;

const ok = (value: StoryEventFact[]) => ({ available: true as const, value });

const events: StoryEventFact[] = [
  {
    abandonmentRationale: "Superseded by sync.",
    occurredAt: "2026-04-04T10:00:00.000Z",
    source: {
      label: "TID-2 Offline queue",
      recordId: "w1",
      recordType: "Work",
    },
    state: "Abandoned",
    title: "TID-2 Offline queue",
  },
  {
    abandonmentRationale: null,
    occurredAt: "2026-04-03T10:00:00.000Z",
    source: { label: "Use SQLite", recordId: "d1", recordType: "Decision" },
    state: "Decided",
    title: "Use SQLite",
  },
];

function timeline(scope: StoryTimelineFacts["scope"], list = events) {
  return deriveStoryTimeline({
    scope,
    sources: {
      "Code change": { available: false, reason: "GitHub has no story read." },
      Decision: ok(list.filter((e) => e.source.recordType === "Decision")),
      Design: ok([]),
      Document: ok([]),
      "Lifecycle change": ok([]),
      Milestone: ok([]),
      "Production Incident": ok([]),
      "Project Release": ok([]),
      "Validation result": ok([]),
      Work: ok(list.filter((e) => e.source.recordType === "Work")),
    },
  });
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(ui));
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

test("renders the Project story as a labelled chronological list", () => {
  const view = render(
    <StoryTimelineView
      projectId="p1"
      timeline={timeline({ kind: "Project", projectId: "p1" })}
    />,
  );
  expect(view.textContent).toContain("Project History");
  expect(view.textContent).toContain("Story Timeline");
  const items = [...view.querySelectorAll("ol > li")];
  expect(items.map((item) => item.querySelector("h4")?.textContent)).toEqual([
    "Use SQLite",
    "TID-2 Offline queue",
  ]);
  expect(
    view.querySelector("section")?.getAttribute("aria-labelledby"),
  ).toBeTruthy();
});

test("shows the abandonment rationale on the related event only", () => {
  const view = render(
    <StoryTimelineView
      projectId="p1"
      timeline={timeline({ kind: "Project", projectId: "p1" })}
    />,
  );
  const [decision, work] = [...view.querySelectorAll("ol > li")];
  expect(work?.textContent).toContain("Abandoned");
  expect(work?.textContent).toContain("Superseded by sync.");
  expect(decision?.textContent).not.toContain("Superseded");
});

test("every event opens its source with a real Open source record link", () => {
  const view = render(
    <StoryTimelineView
      projectId="p1"
      timeline={timeline({ kind: "Project", projectId: "p1" })}
    />,
  );
  const links = [...view.querySelectorAll("a")].filter(
    (a) => a.textContent === "Open source record",
  );
  expect(links.map((a) => a.getAttribute("href"))).toEqual([
    "/projects/p1#source-decision-d1",
    "/projects/p1#work-w1",
  ]);
  expect(links[0]?.getAttribute("aria-label")).toBe(
    "Open source record: Use SQLite",
  );
});

test("a Feature story is labelled with its Feature, not the whole Project", () => {
  const view = render(
    <StoryTimelineView
      projectId="p1"
      timeline={timeline(
        {
          key: "TID-1",
          kind: "Feature",
          projectId: "p1",
          title: "Sync",
          workId: "f1",
        },
        [events[1] as StoryEventFact],
      )}
    />,
  );
  expect(view.textContent).toContain("TID-1 Sync");
});

test("names an unavailable source and an empty story without a narrative", () => {
  const view = render(
    <StoryTimelineView
      projectId="p1"
      timeline={timeline({ kind: "Project", projectId: "p1" }, [])}
    />,
  );
  expect(view.textContent).toContain("No realized events yet.");
  expect(view.textContent).toContain("Code change");
  expect(view.textContent).toContain("GitHub has no story read.");
  expect(view.textContent).not.toMatch(SIGNAL_OR_NARRATIVE);
  expect(view.querySelectorAll("button, input, textarea, select")).toHaveLength(
    0,
  );
});
