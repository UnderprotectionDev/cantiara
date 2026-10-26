// @vitest-environment happy-dom

import {
  deriveProjectActivity,
  PROJECT_ACTIVITY_LABEL,
  PROJECT_ACTIVITY_OPEN_SOURCE_LABEL,
  PROJECT_ACTIVITY_QUESTION_LABEL,
  PROJECT_HISTORY_LABEL,
  type ProjectActivityHistoryFact,
  projectActivityInputSchema,
} from "@cantiara/api/project-activity";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { NO_PROJECT_ACTIVITY_FILTERS } from "../../../lib/project-activity-filters";
import {
  ProjectActivityView,
  RecordActivityView,
} from "../project-activity-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const HUMAN = { clientIdempotencyKey: "k", kind: "human" } as const;
const SIGNAL_OR_STORY = /signal|notification|story timeline|digest/i;

function entry(
  overrides: Partial<ProjectActivityHistoryFact>,
): ProjectActivityHistoryFact {
  return {
    actor: { actorId: "user-1", type: "User" },
    id: "h1",
    nextValue: { work: { status: "Done", title: "Ship" } },
    occurredAt: "2026-05-01T10:00:00.000Z",
    origin: HUMAN,
    previousValue: { work: { status: "Todo", title: "Ship" } },
    relation: false,
    revision: 1,
    source: { label: "TID-1 Ship", recordId: "work-1", recordType: "Work" },
    ...overrides,
  };
}

function activityOf(history: ProjectActivityHistoryFact[]) {
  return deriveProjectActivity(
    "p1",
    {
      history,
      unattributed: ["Backlog order (keyed by Project)"],
      windowReached: false,
    },
    projectActivityInputSchema.parse({ projectId: "p1" }),
  );
}

let root: Root | null = null;
let container: HTMLElement | null = null;

function render(
  history: ProjectActivityHistoryFact[],
  props: Partial<Parameters<typeof ProjectActivityView>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <ProjectActivityView
        activity={activityOf(history)}
        filters={NO_PROJECT_ACTIVITY_FILTERS}
        hasMore={false}
        loadingMore={false}
        onApplyFilters={vi.fn()}
        onLoadMore={vi.fn()}
        projectId="p1"
        {...props}
      />,
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

test("shows the closed labels and answers What changed? as a list", () => {
  const view = render([entry({})]);
  expect(view.textContent).toContain(PROJECT_HISTORY_LABEL);
  expect(view.textContent).toContain(PROJECT_ACTIVITY_LABEL);
  expect(view.textContent).toContain(PROJECT_ACTIVITY_QUESTION_LABEL);
  expect([
    PROJECT_HISTORY_LABEL,
    PROJECT_ACTIVITY_LABEL,
    PROJECT_ACTIVITY_QUESTION_LABEL,
    PROJECT_ACTIVITY_OPEN_SOURCE_LABEL,
  ]).toEqual([
    "Project History",
    "Project Activity",
    "What changed?",
    "Open source record",
  ]);
  const list = view.querySelector("ol");
  expect(list?.getAttribute("aria-label")).toBe("Project Activity");
  expect(list?.querySelectorAll(":scope > li")).toHaveLength(1);
});

test("each row names its actor, shows previous and next, and opens the source record", () => {
  const view = render([
    entry({ id: "h1" }),
    entry({
      actor: { actorId: "rule-1", type: "System automation" },
      id: "h2",
      occurredAt: "2026-05-01T11:00:00.000Z",
    }),
    entry({
      actor: { actorId: "gh-1", type: "GitHub" },
      id: "h3",
      occurredAt: "2026-05-01T12:00:00.000Z",
      origin: { deliveryId: "d1", kind: "source", sourceId: "s1" },
      source: { label: "Data loss", recordId: "risk-1", recordType: "Risk" },
    }),
  ]);
  const rows = [...view.querySelectorAll("ol > li")];
  expect(rows).toHaveLength(3);
  expect(rows[0]?.textContent).toContain("GitHub");
  expect(rows[1]?.textContent).toContain("System automation");
  expect(rows[2]?.textContent).toContain("User");
  expect(rows[2]?.textContent).toContain("status: Todo → Done");
  const links = [...view.querySelectorAll("ol a")].map((link) => ({
    href: link.getAttribute("href"),
    text: link.textContent,
  }));
  expect(links).toEqual([
    { href: "/projects/p1#source-risk-risk-1", text: "Open source record" },
    { href: "/projects/p1#work-work-1", text: "Open source record" },
    { href: "/projects/p1#work-work-1", text: "Open source record" },
  ]);
});

test("a secret or redacted value shows no content", () => {
  const view = render([
    entry({
      nextValue: { work: { apiToken: "sk-live-NEW", title: "Ship" } },
      previousValue: { work: { apiToken: "sk-live-OLD", title: "Ship" } },
    }),
    entry({
      id: "h2",
      nextValue: { work: { redacted: true } },
      previousValue: { work: { title: "leaks-if-shown" } },
    }),
  ]);
  const text = view.textContent ?? "";
  expect(text).toContain("value redacted");
  expect(text).toContain("Redacted for security");
  for (const secret of ["sk-live-NEW", "sk-live-OLD", "leaks-if-shown"]) {
    expect(text).not.toContain(secret);
  }
});

test("filters are real form controls that apply and clear the closed sets", () => {
  const onApplyFilters = vi.fn();
  const view = render([entry({})], { onApplyFilters });
  const form = view.querySelector("form");
  expect(form?.getAttribute("aria-label")).toBe("Filter Project Activity");
  const groups = [...view.querySelectorAll("fieldset legend")].map(
    (legend) => legend.textContent,
  );
  expect(groups).toEqual(["Source type", "Event type"]);
  const labels = [...view.querySelectorAll("fieldset label")].map(
    (label) => label.textContent,
  );
  expect(labels).toEqual([
    "Work",
    "Document",
    "Decision",
    "Risk",
    "Automation",
    "GitHub",
    "Create",
    "Field change",
    "Status change",
    "Archive",
    "Relation",
    "Automation",
  ]);
  const risk = view
    .querySelectorAll<HTMLElement>('fieldset [role="checkbox"]')
    .item(3);
  expect(risk).not.toBeNull();
  act(() => risk?.click());
  const submit = [...view.querySelectorAll("button")].find(
    (button) => button.textContent === "Apply filters",
  );
  act(() => submit?.click());
  return vi.waitFor(() =>
    expect(onApplyFilters).toHaveBeenCalledWith({
      eventTypes: [],
      sourceTypes: ["Risk"],
    }),
  );
});

test("shows no signal, notification, story or digest surface and states what is unavailable", () => {
  const view = render([entry({})]);
  const heading = view.querySelector("h2, h3");
  expect(heading).not.toBeNull();
  const interactive = [...view.querySelectorAll("button, a")].map(
    (node) => node.textContent ?? "",
  );
  for (const label of interactive) {
    expect(label).not.toMatch(SIGNAL_OR_STORY);
  }
  expect(view.textContent).toContain("GitHub: Only changes GitHub made");
  expect(view.textContent).toContain("Backlog order (keyed by Project)");
});

test("an empty result says so and offers older changes only when more exist", () => {
  const empty = render([]);
  expect(empty.textContent).toContain("No changes match these filters.");
  expect(empty.querySelector("ol")).toBeNull();
  expect(
    [...empty.querySelectorAll("button")].some(
      (button) => button.textContent === "Show older changes",
    ),
  ).toBe(false);
});

test("five-minute field changes form one accessible disclosure that lists every atomic event", () => {
  const view = render([
    entry({
      id: "h1",
      nextValue: { work: { title: "B" } },
      previousValue: { work: { title: "A" } },
    }),
    entry({
      id: "h2",
      nextValue: { work: { title: "C" } },
      occurredAt: "2026-05-01T10:02:00.000Z",
      previousValue: { work: { title: "B" } },
      undo: { kind: "field" },
    }),
    entry({
      id: "h3",
      nextValue: { work: { status: "Done", title: "C" } },
      occurredAt: "2026-05-01T10:03:00.000Z",
      previousValue: { work: { status: "Todo", title: "C" } },
    }),
  ]);
  const top = [
    ...view.querySelectorAll("ol[aria-label='Project Activity'] > li"),
  ];
  expect(top).toHaveLength(2);
  const toggle = top[1]?.querySelector("button");
  expect(top[1]?.textContent).toContain("2 field changes");
  expect(top[1]?.textContent).toContain("title");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  expect(top[1]?.querySelectorAll("ol li")).toHaveLength(0);
  act(() => toggle?.click());
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  const controlled = toggle?.getAttribute("aria-controls") ?? "";
  expect(
    document.getElementById(controlled)?.querySelectorAll("ol > li"),
  ).toHaveLength(2);
  const text = top[1]?.textContent ?? "";
  expect(text).toContain("title: A → B");
  expect(text).toContain("title: B → C");
  expect(top[0]?.textContent).toContain("Status change");
});

test("a failed load-more is announced and the list stays", () => {
  const view = render([entry({})], { hasMore: true, loadMoreFailed: true });
  expect(view.querySelector("[role='alert']")?.textContent).toBe(
    "Older changes could not be loaded.",
  );
  expect(view.textContent).toContain("Show older changes");
});

test("the record history shows the record's clustered entries", () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <RecordActivityView
        activity={activityOf([
          entry({
            id: "h1",
            nextValue: { work: { title: "B" } },
            previousValue: { work: { title: "A" } },
          }),
          entry({
            id: "h2",
            nextValue: { work: { title: "C" } },
            occurredAt: "2026-05-01T10:02:00.000Z",
            previousValue: { work: { title: "B" } },
          }),
        ])}
        hasMore={false}
        loadingMore={false}
        loadMoreFailed={false}
        onLoadMore={vi.fn()}
        projectId="p1"
      />,
    );
  });
  expect(
    container.querySelector("ol[aria-label='Record history']"),
  ).not.toBeNull();
  expect(container.textContent).toContain("2 field changes");
});
