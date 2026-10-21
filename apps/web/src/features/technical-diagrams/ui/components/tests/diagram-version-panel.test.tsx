// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { DiagramVersionPanel } from "../diagram-version-panel";
import { TechnicalDiagramEditor } from "../technical-diagram-editor";

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

const render = (element: React.ReactElement) => act(() => root.render(element));

function typeInto(input: HTMLInputElement | null, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const version: TechnicalDiagramVersion = {
  authorityMode: "Product-authored Model",
  createdAt: "2026-10-21T08:00:00.000Z",
  diagramId: "arch",
  id: "v-1",
  model: { links: [], nodes: [] },
  name: "Before split",
  number: 1,
  revision: 3,
  type: "Technical Architecture",
};

const diagram = {
  authorityMode: "Product-authored Model",
  id: "arch",
  revision: 4,
} as const;

describe("Diagram Version panel", () => {
  test("creates a named Diagram Version from a labelled form", async () => {
    const created: string[] = [];
    render(
      <DiagramVersionPanel
        diagram={diagram}
        disabled={false}
        error={null}
        onCreate={(name) => created.push(name)}
        onRestore={() => undefined}
        versions={[]}
      />,
    );
    const region = container.querySelector(
      'section[aria-label="Diagram Version"]',
    );
    expect(region?.textContent).toContain("immutable checkpoint");
    const input = container.querySelector<HTMLInputElement>("input");
    expect(
      container.querySelector(`label[for="${input?.id}"]`)?.textContent,
    ).toBe("Diagram Version name");
    typeInto(input, "Before split");
    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });
    expect(created).toEqual(["Before split"]);
  });

  test("lists checkpoints and restores one by an accessible button without editing it", () => {
    const restored: string[] = [];
    render(
      <DiagramVersionPanel
        diagram={diagram}
        disabled={false}
        error={null}
        onCreate={() => undefined}
        onRestore={(item) => restored.push(item.id)}
        versions={[version]}
      />,
    );
    const list = container.querySelector('ol[aria-label="Diagram Versions"]');
    expect(list?.textContent).toContain("Before split · version 1");
    expect(container.textContent).toContain(
      "Restore writes a new live revision; the Diagram Version stays unchanged.",
    );
    const restore = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Restore Diagram Version Before split"]',
    );
    act(() => restore?.click());
    expect(restored).toEqual(["v-1"]);
    expect(container.querySelector('button[aria-label^="Edit"]')).toBeNull();
    expect(container.querySelector('button[aria-label^="Delete"]')).toBeNull();
  });

  test("announces a failure and offers no version of an External Source Link", () => {
    render(
      <DiagramVersionPanel
        diagram={diagram}
        disabled={false}
        error="The Technical Diagram changed after it was shown."
        onCreate={() => undefined}
        onRestore={() => undefined}
        versions={[]}
      />,
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "changed after it was shown",
    );
    render(
      <DiagramVersionPanel
        diagram={{ ...diagram, authorityMode: "External Source Link" }}
        disabled={false}
        error={null}
        onCreate={() => undefined}
        onRestore={() => undefined}
        versions={[]}
      />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("has no Diagram Version");
  });
});

describe("Sequence lifeline bind with a Diagram Version", () => {
  test("saves the exact Diagram Version the founder chose", async () => {
    const saved: unknown[] = [];
    const sequence: TechnicalDiagramSource = {
      authorityMode: "Product-authored Model",
      externalSource: null,
      id: "flow",
      model: { participants: [], steps: [] },
      origins: [],
      projectId: "p1",
      revision: 1,
      title: "Flow",
      type: "Technical Sequence",
      view: null,
    };
    render(
      <TechnicalDiagramEditor
        bindOptions={[
          {
            boundLabel: "API",
            diagramId: "arch",
            diagramTitle: "Platform",
            nodeId: "api",
          },
          {
            boundLabel: "API",
            diagramId: "arch",
            diagramTitle: "Platform",
            nodeId: "api",
            versionId: "v-1",
            versionName: "Before split",
          },
        ]}
        diagram={sequence}
        disabled={false}
        onSave={(model) => saved.push(model)}
      />,
    );
    const form = container.querySelector('form[aria-label="Add participant"]');
    const select = [...(form?.querySelectorAll("select") ?? [])].find(
      (item) =>
        item.previousElementSibling?.textContent ===
        "Bind to Architecture node",
    );
    expect(select?.textContent).toContain(
      "Platform / API (Diagram Version Before split)",
    );
    expect(select?.textContent).toContain("Platform / API (live node");
    typeInto(form?.querySelector("input") ?? null, "Service");
    act(() => {
      if (select) {
        select.value = "arch:api:v-1";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(saved[0]).toMatchObject({
      participants: [
        { bind: { diagramId: "arch", nodeId: "api", versionId: "v-1" } },
      ],
    });
  });
});
