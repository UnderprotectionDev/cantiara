// @vitest-environment happy-dom
import type {
  ProjectWallCardView,
  ProjectWallRelationPreview,
  ProjectWallSourceOption,
  ProjectWallSummary,
  ProjectWallView,
} from "@cantiara/api/project-wall";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProjectWallCard } from "./project-wall-card";
import { ProjectWallNarrativePanel } from "./project-wall-narrative";
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
    groupId: null,
    highlight: null,
    id: "card-1",
    locked: false,
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
    groups: [],
    id: "wall-1",
    links: [],
    projectId: "p1",
    title: "Launch story",
    updatedAt: NOW,
  };
}

function actions(): ProjectWallActions {
  return {
    onAddCard: vi.fn(async () => undefined),
    onCreate: vi.fn(async () => undefined),
    onCreateGroup: vi.fn(async () => undefined),
    onCreateRelation: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undefined),
    onDeleteGroup: vi.fn(async () => undefined),
    onDrawLink: vi.fn(async () => undefined),
    onPreviewRelation: vi.fn(async () => undefined),
    onToggleGroup: vi.fn(async () => undefined),
    onUnbindLink: vi.fn(async () => undefined),
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
          onGroup: vi.fn(),
          onHighlight: vi.fn(),
          onLock: vi.fn(),
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
      onGroup: vi.fn(),
      onHighlight: vi.fn(),
      onLock: vi.fn(),
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
    const picker = html.slice(
      html.indexOf('id="project-wall-source"'),
      html.indexOf("</select>", html.indexOf('id="project-wall-source"')),
    );
    expect(picker).not.toContain("Work · Ship onboarding");
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

function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(node));
  return host;
}

function buttonNamed(container: HTMLElement, name: string) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent === name,
  );
}

const SKETCH_OR_FREEHAND = /Sketch|Freehand|Draw freehand|Pen tool/i;

function linkedWall(): ProjectWallView {
  const decisionCard = card({
    id: "card-2",
    source: {
      broken: null,
      kind: "Decision",
      openPath: "/projects/p1#decision-d1",
      recordId: "d1",
      status: "Valid",
      title: "Use a flat wall",
    },
    sourceType: "Decision",
  });
  return {
    ...wall([card(), decisionCard]),
    groups: [{ collapsed: false, id: "group-1", title: "Onboarding" }],
    links: [
      {
        fromCardId: "card-1",
        id: "link-1",
        label: "informs",
        toCardId: "card-2",
      },
    ],
  };
}

const PREVIEW: ProjectWallRelationPreview = {
  linkId: "link-1",
  relation: {
    baseRevision: 0,
    blockingStatus: null,
    id: "preview-1",
    inverseLabel: "Related",
    kind: "Related",
    label: "Related",
    previewId: "preview-1",
    source: {
      broken: null,
      key: null,
      label: null,
      originPosition: null,
      projectId: "p1",
      recordId: "w1",
      recordType: "Work",
      status: null,
      title: "Ship onboarding",
      workType: null,
    },
    target: {
      broken: null,
      key: null,
      label: null,
      originPosition: null,
      projectId: "p1",
      recordId: "d1",
      recordType: "Decision",
      status: null,
      title: "Use a flat wall",
      workType: null,
    },
  },
};

describe("Project Wall: Visual links, groups and Lock Position", () => {
  test("Lock Position toggles view-local lock and is labelled in text", () => {
    const handlers = {
      onDensity: vi.fn(),
      onGroup: vi.fn(),
      onHighlight: vi.fn(),
      onLock: vi.fn(),
      onRemove: vi.fn(),
    };
    const container = mount(
      <ProjectWallCard actions={handlers} card={card({ locked: true })} />,
    );
    expect(container.textContent).toContain("Position locked");
    act(() => buttonNamed(container, "Lock Position")?.click());
    expect(handlers.onLock).toHaveBeenCalledWith("card-1", false);
    expect(handlers.onRemove).not.toHaveBeenCalled();
  });

  test("a Visual link is listed with From, To and Unbind and says it is not a relation", () => {
    const handlers = actions();
    const container = mount(
      <ProjectWallNarrativePanel actions={handlers} wall={linkedWall()} />,
    );
    expect(container.textContent).toContain("informs");
    expect(container.textContent).toContain("From");
    expect(container.textContent).toContain("To");
    expect(container.textContent).toContain("not record relations");
    act(() => buttonNamed(container, "Unbind")?.click());
    expect(handlers.onUnbindLink).toHaveBeenCalledWith("link-1");
    expect(handlers.onCreateRelation).not.toHaveBeenCalled();
  });

  test("Create Persistent Relation only previews until the explicit confirm", async () => {
    const handlers = actions();
    handlers.onPreviewRelation = vi.fn(async () => PREVIEW);
    const container = mount(
      <ProjectWallNarrativePanel actions={handlers} wall={linkedWall()} />,
    );

    await act(async () =>
      buttonNamed(container, "Create Persistent Relation")?.click(),
    );
    expect(handlers.onPreviewRelation).toHaveBeenCalledWith({
      kind: "Related",
      linkId: "link-1",
    });
    expect(handlers.onCreateRelation).not.toHaveBeenCalled();
    expect(
      container.querySelector('[aria-label="Persistent relation preview"]'),
    ).not.toBeNull();

    await act(async () =>
      buttonNamed(container, "Confirm Create Persistent Relation")?.click(),
    );
    expect(handlers.onCreateRelation).toHaveBeenCalledWith({
      baseRevision: 0,
      kind: "Related",
      linkId: "link-1",
      previewId: "preview-1",
    });
  });

  test("cancelling the preview writes nothing", async () => {
    const handlers = actions();
    handlers.onPreviewRelation = vi.fn(async () => PREVIEW);
    const container = mount(
      <ProjectWallNarrativePanel actions={handlers} wall={linkedWall()} />,
    );
    await act(async () =>
      buttonNamed(container, "Create Persistent Relation")?.click(),
    );
    act(() => buttonNamed(container, "Cancel")?.click());
    expect(handlers.onCreateRelation).not.toHaveBeenCalled();
    expect(
      container.querySelector('[aria-label="Persistent relation preview"]'),
    ).toBeNull();
  });

  test("groups are named and single-level, with collapse as wall state", () => {
    const handlers = actions();
    const container = mount(
      <ProjectWallNarrativePanel actions={handlers} wall={linkedWall()} />,
    );
    expect(container.textContent).toContain("Onboarding");
    act(() => buttonNamed(container, "Collapse group")?.click());
    expect(handlers.onToggleGroup).toHaveBeenCalledWith("group-1", true);
    expect(container.textContent).not.toMatch(NESTED_OR_WORKSPACE);
  });

  test("the wall offers no freehand drawing or Sketch card", () => {
    const html = renderToStaticMarkup(
      <ProjectWallLayout
        actions={actions()}
        canvas={<p>canvas</p>}
        options={options}
        selected={linkedWall()}
        walls={[summary]}
      />,
    );
    expect(html).not.toMatch(SKETCH_OR_FREEHAND);
    expect(html).not.toContain("<canvas");
    expect(html).not.toMatch(FOREIGN_SURFACES);
  });
});
