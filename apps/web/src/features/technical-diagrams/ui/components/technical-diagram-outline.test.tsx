// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the saved list.
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { TechnicalDiagramEditor } from "./technical-diagram-editor";
import { TechnicalDiagramOutline } from "./technical-diagram-outline";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element: React.ReactElement) {
  act(() => root.render(element));
}

const base = {
  authorityMode: "Product-authored Model",
  externalSource: null,
  id: "d1",
  origins: [] as TechnicalDiagramSource["origins"],
  projectId: "p1",
  revision: 1,
  view: null,
} as const;

describe("Technical Diagram structured outline", () => {
  test("lists Architecture nodes and typed links as text", () => {
    render(
      <TechnicalDiagramOutline
        diagram={{
          model: {
            links: [{ from: "a", kind: "Writes to", label: null, to: "b" }],
            nodes: [
              { id: "a", kind: "Service", label: "API" },
              { id: "b", kind: "Datastore", label: "PostgreSQL" },
            ],
          },
          title: "Platform",
          type: "Technical Architecture",
        }}
      />,
    );
    const outline = container.querySelector(
      '[aria-label="Technical Diagram outline"]',
    );
    expect(outline?.getAttribute("tabindex")).toBe("0");
    expect(outline?.textContent).toContain("API · Service");
    expect(outline?.textContent).toContain("API Writes to PostgreSQL");
  });

  test("lists Data Model keys, nullability, relations and referential actions", () => {
    render(
      <TechnicalDiagramOutline
        diagram={{
          model: {
            relations: [
              {
                cardinality: "One to many",
                fromColumnId: "t.p",
                fromTableId: "t",
                id: "r",
                onDelete: "CASCADE",
                onUpdate: "NO ACTION",
                toColumnId: "p.id",
                toTableId: "p",
              },
            ],
            tables: [
              {
                columns: [
                  {
                    default: null,
                    id: "p.id",
                    name: "id",
                    nullable: false,
                    primaryKey: true,
                    type: "uuid",
                    unique: false,
                  },
                ],
                id: "p",
                indexes: [],
                name: "project",
              },
              {
                columns: [
                  {
                    default: null,
                    id: "t.p",
                    name: "project_id",
                    nullable: false,
                    primaryKey: false,
                    type: "uuid",
                    unique: false,
                  },
                ],
                id: "t",
                indexes: [],
                name: "task",
              },
            ],
          },
          title: "Schema",
          type: "Data Model",
        }}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("id · uuid · primary key · not null");
    expect(text).toContain(
      "task.project_id references project.id · One to many · on delete CASCADE",
    );
  });

  test("lists Sequence participants, ordered messages, groups and the unpinned bind", () => {
    render(
      <TechnicalDiagramOutline
        diagram={{
          model: {
            participants: [
              { bind: null, id: "u", kind: "Actor", label: "Founder" },
              {
                bind: {
                  boundLabel: "API",
                  diagramId: "d0",
                  nodeId: "api",
                  versionId: null,
                },
                id: "a",
                kind: "Component",
                label: "API",
              },
            ],
            steps: [
              {
                from: "u",
                id: "m1",
                kind: "Message",
                label: "Open",
                messageKind: "Sync",
                to: "a",
              },
              {
                condition: "cached",
                groupKind: "Alt",
                id: "g",
                kind: "Group",
                steps: [
                  {
                    from: "a",
                    id: "m2",
                    kind: "Message",
                    label: "Read",
                    messageKind: "Event",
                    to: "a",
                  },
                ],
              },
            ],
          },
          title: "Open project",
          type: "Technical Sequence",
        }}
      />,
    );
    const steps = container.querySelector('[aria-label="Sequence steps"]');
    expect(steps?.textContent).toContain("Founder → API · Sync · Open");
    expect(steps?.textContent).toContain("Alt · cached");
    expect(container.textContent).toContain(
      "bound to API (node only, no Diagram Version pinned)",
    );
  });
});

describe("Technical Diagram editor", () => {
  test("offers type-specific forms and none for an External Source Link", () => {
    const diagram: TechnicalDiagramSource = {
      ...base,
      model: { links: [], nodes: [] },
      title: "Platform",
      type: "Technical Architecture",
    };
    render(
      <TechnicalDiagramEditor
        bindOptions={[]}
        diagram={diagram}
        disabled={false}
        onSave={() => undefined}
      />,
    );
    expect(
      container.querySelector('form[aria-label="Add node"]'),
    ).not.toBeNull();
    expect(container.querySelector('form[aria-label="Add table"]')).toBeNull();

    render(
      <TechnicalDiagramEditor
        bindOptions={[]}
        diagram={{
          ...diagram,
          authorityMode: "External Source Link",
          type: "Data Model",
        }}
        disabled={false}
        onSave={() => undefined}
      />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("stays in the external tool");
  });

  test("saves an added Architecture node through the typed model", async () => {
    const saved: unknown[] = [];
    render(
      <TechnicalDiagramEditor
        bindOptions={[]}
        diagram={{
          ...base,
          model: { links: [], nodes: [] },
          title: "Platform",
          type: "Technical Architecture",
        }}
        disabled={false}
        onSave={(model) => saved.push(model)}
      />,
    );
    const label = container.querySelector<HTMLInputElement>(
      'form[aria-label="Add node"] input',
    );
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(label, "Jobs");
      label?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('form[aria-label="Add node"]')
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      nodes: [{ kind: "Component", label: "Jobs" }],
    });
  });
});
