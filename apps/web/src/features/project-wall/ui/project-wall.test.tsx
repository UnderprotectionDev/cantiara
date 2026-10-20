// @vitest-environment happy-dom
import type {
  ProjectWallCardView,
  ProjectWallSourceOption,
  ProjectWallSummary,
  ProjectWallView,
} from "@cantiara/api/project-wall";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProjectWallCard } from "./project-wall-card";
import {
  type ProjectWallActions,
  ProjectWallLayout,
} from "./project-wall-view";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EDITABLE_CONTENT = /<textarea|type="file"|contenteditable/i;
const FOREIGN_SURFACES = /Wireframe|Moodboard|Wiki/;
const NESTED_OR_WORKSPACE = /Workspace wall|Sub-wall|Nested|Parent wall/i;
const NOW = "2026-10-20T09:00:00.000Z";
let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function card(
  overrides: Partial<ProjectWallCardView> = {},
): ProjectWallCardView {
  return {
    density: "Preview",
    fields: [
      { name: "Key", value: "CAN-1" },
      { name: "Status", value: "In Progress" },
    ],
    highlight: null,
    id: "card-1",
    placedAt: NOW,
    position: { x: 0, y: 0 },
    source: {
      broken: null,
      kind: "Work",
      openPath: "/projects/p1#work-w1",
      recordId: "w1",
      status: "In Progress",
      title: "Ship onboarding",
    },
    sourceType: "Work",
    ...overrides,
  };
}

function wall(cards: ProjectWallCardView[]): ProjectWallView {
  return {
    cards,
    createdAt: NOW,
    id: "wall-1",
    projectId: "p1",
    title: "Launch story",
    updatedAt: NOW,
  };
}

function actions(): ProjectWallActions {
  return {
    onAddCard: vi.fn(async () => undefined),
    onCreate: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undefined),
    onRename: vi.fn(async () => undefined),
    onSelect: vi.fn(),
  };
}

const summary: ProjectWallSummary = {
  cardCount: 1,
  createdAt: NOW,
  id: "wall-1",
  projectId: "p1",
  title: "Launch story",
  updatedAt: NOW,
};

const options: ProjectWallSourceOption[] = [
  { id: "w1", sourceType: "Work", title: "Ship onboarding" },
  { id: "d1", sourceType: "Decision", title: "Use a flat wall" },
];

describe("Project Wall card", () => {
  test("shows the live source title, product-chosen fields and Open Source Record", () => {
    const html = renderToStaticMarkup(<ProjectWallCard card={card()} />);
    expect(html).toContain("Ship onboarding");
    expect(html).toContain("CAN-1");
    expect(html).toContain("In Progress");
    expect(html).toContain('href="/projects/p1#work-w1"');
    expect(html).toContain("Open Source Record");
    expect(html).toContain('data-source-id="w1"');
  });

  test("a card has no note, task, file or free field editor", () => {
    const html = renderToStaticMarkup(
      <ProjectWallCard
        actions={{
          onDensity: vi.fn(),
          onHighlight: vi.fn(),
          onRemove: vi.fn(),
        }}
        card={card()}
      />,
    );
    expect(html).not.toMatch(EDITABLE_CONTENT);
    expect(html).toContain("Compact");
    expect(html).toContain("Preview");
    expect(html).toContain("Detailed");
    expect(html).not.toMatch(FOREIGN_SURFACES);
  });

  test("a broken target explains the reason and cannot be opened", () => {
    const html = renderToStaticMarkup(
      <ProjectWallCard
        card={card({
          fields: [],
          source: {
            broken: {
              canOpenSourceRecord: false,
              establishedAt: NOW,
              reason: "Permanently deleted",
            },
            kind: "Work",
            openPath: null,
            recordId: "w1",
            status: null,
            title: null,
          },
        })}
      />,
    );
    expect(html).toContain("Broken — Permanently deleted");
    expect(html).not.toContain("Open Source Record");
  });

  test("a highlight is labelled in text, not colour alone", () => {
    const html = renderToStaticMarkup(
      <ProjectWallCard card={card({ highlight: "amber" })} />,
    );
    expect(html).toContain("Highlight: amber");
  });

  test("density and highlight controls report wall view changes only", () => {
    const handlers = {
      onDensity: vi.fn(),
      onHighlight: vi.fn(),
      onRemove: vi.fn(),
    };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(<ProjectWallCard actions={handlers} card={card()} />),
    );

    const detailed = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Detailed",
    );
    act(() => detailed?.click());
    expect(handlers.onDensity).toHaveBeenCalledWith("card-1", "Detailed");
    expect(handlers.onRemove).not.toHaveBeenCalled();
  });
});

describe("Project Wall layout", () => {
  test("an empty Project shows the empty state and Create Project Wall", () => {
    const html = renderToStaticMarkup(
      <ProjectWallLayout
        actions={actions()}
        canvas={null}
        options={options}
        selected={null}
        walls={[]}
      />,
    );
    expect(html).toContain("Project Wall");
    expect(html).toContain("No Project Wall yet.");
    expect(html).toContain("Create Project Wall");
  });

  test("offers only records not yet on the wall and nothing nested or Workspace-wide", () => {
    const html = renderToStaticMarkup(
      <ProjectWallLayout
        actions={actions()}
        canvas={<p>canvas</p>}
        options={options}
        selected={wall([card()])}
        walls={[summary]}
      />,
    );
    expect(html).toContain("Use a flat wall");
    expect(html).not.toContain("Work · Ship onboarding");
    expect(html).toContain("Place live card");
    expect(html).not.toMatch(NESTED_OR_WORKSPACE);
  });

  test("adding a card sends only the source id and type", () => {
    const handlers = actions();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <ProjectWallLayout
          actions={handlers}
          canvas={null}
          options={options}
          selected={wall([])}
          walls={[summary]}
        />,
      ),
    );
    const select = host.querySelector<HTMLSelectElement>(
      "#project-wall-source",
    );
    expect(select).not.toBeNull();
    act(() => {
      if (select) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        )?.set;
        setter?.call(select, "Decision:d1");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const form = host.querySelector<HTMLFormElement>(
      'form[aria-label="Place live card"]',
    );
    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(handlers.onAddCard).toHaveBeenCalledWith({
      sourceId: "d1",
      sourceType: "Decision",
    });
  });
});
