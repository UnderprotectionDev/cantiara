// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import type {
  ConvertToRecordPlan,
  DiagramRecordCardView,
} from "@cantiara/api/technical-diagram-card";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DiagramCompositionPanel } from "./diagram-composition-panel";

const version: TechnicalDiagramVersion = {
  authorityMode: "Product-authored Model",
  createdAt: "2026-10-20T08:00:00.000Z",
  diagramId: "diagram-1",
  id: "version-1",
  model: {
    links: [],
    nodes: [{ id: "api", kind: "Service", label: "Gateway" }],
  },
  name: "Launch",
  number: 1,
  revision: 2,
  type: "Technical Architecture",
};

const plan: ConvertToRecordPlan = {
  authorityEffect: "None",
  diagram: {
    authorityMode: "Product-authored Model",
    id: "diagram-1",
    title: "Platform",
    type: "Technical Architecture",
  },
  node: { id: "api", kind: "Service", label: "Gateway" },
  originLocation: {
    diagramId: "diagram-1",
    nodeId: "api",
    versionId: "version-1",
    versionNumber: 1,
  },
  record: {
    body: "Gateway (Service) from Platform, Diagram Version 1 Launch.",
    title: "Gateway",
    type: "Decision",
    workType: null,
  },
  recordCount: 1,
  targetProject: { id: "project-1", name: "Cantiara" },
  version: {
    diagramId: "diagram-1",
    kind: "Diagram Version",
    name: "Launch",
    number: 1,
    versionId: "version-1",
  },
};

const card = (
  overrides: Partial<DiagramRecordCardView> = {},
): DiagramRecordCardView => ({
  broken: null,
  diagramId: "diagram-1",
  id: "card-1",
  openPath: "/projects/project-1#source-risk-risk-1",
  sourceId: "risk-1",
  sourceType: "Risk",
  status: "Open",
  title: "Vendor lock-in",
  x: 0,
  y: 0,
  ...overrides,
});

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

function choose(label: string, value: string) {
  const labelElement = [...container.querySelectorAll("label")].find(
    (item) => item.textContent === label,
  );
  const select = container.querySelector<HTMLSelectElement>(
    `#${CSS.escape(labelElement?.htmlFor ?? "")}`,
  );
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(select, value);
    select?.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function button(scope: ParentNode, name: string) {
  return [...scope.querySelectorAll("button")].find(
    (item) => item.textContent === name,
  ) as HTMLButtonElement | undefined;
}

function click(element: Element | undefined) {
  act(() => element?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

/** TanStack Form submits asynchronously, so form-backed buttons settle in an async act. */
async function clickAndSettle(element: Element | undefined) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function renderPanel(
  props: Partial<Parameters<typeof DiagramCompositionPanel>[0]> = {},
) {
  const handlers = {
    onCancelConvert: vi.fn(),
    onConfirmConvert: vi.fn(),
    onPlace: vi.fn(),
    onPreviewConvert: vi.fn(),
    onRemove: vi.fn(),
  };
  act(() =>
    root.render(
      <DiagramCompositionPanel
        cards={[]}
        diagram={{ authorityMode: "Product-authored Model", id: "diagram-1" }}
        disabled={false}
        error={null}
        options={[{ id: "risk-2", sourceType: "Risk", title: "Second risk" }]}
        plan={null}
        versions={[version]}
        {...handlers}
        {...props}
      />,
    ),
  );
  return handlers;
}

describe("DiagramCompositionPanel", () => {
  test("a record card is a read-only live card that opens its source", () => {
    renderPanel({ cards: [card()] });
    expect(container.textContent).toContain("Vendor lock-in");
    expect(container.textContent).toContain("Read-only live card");
    expect(
      container.querySelector(
        'a[href="/projects/project-1#source-risk-risk-1"]',
      )?.textContent,
    ).toBe("Open source record");
    expect(container.querySelector('input[type="text"], textarea')).toBeNull();
  });

  test("a deleted source is a broken card with no old title", () => {
    renderPanel({
      cards: [
        card({
          broken: { canOpenSourceRecord: false, reason: "Permanently deleted" },
          openPath: null,
          status: null,
          title: null,
        }),
      ],
    });
    expect(container.textContent).toContain("Broken — Permanently deleted");
    expect(container.textContent).not.toContain("Vendor lock-in");
    expect(container.querySelector("a")).toBeNull();
  });

  test("places an existing record and offers only records not yet placed", async () => {
    const { onPlace } = renderPanel({
      cards: [card({ sourceId: "risk-1" })],
      options: [
        { id: "risk-1", sourceType: "Risk", title: "Vendor lock-in" },
        { id: "risk-2", sourceType: "Risk", title: "Second risk" },
      ],
    });
    const optionTexts = [...container.querySelectorAll("option")].map(
      (item) => item.textContent,
    );
    expect(optionTexts).toContain("Risk · Second risk");
    expect(optionTexts).not.toContain("Risk · Vendor lock-in");
    choose("Existing record", "Risk:risk-2");
    await clickAndSettle(button(container, "Place live card"));
    expect(onPlace).toHaveBeenCalledWith({
      id: "risk-2",
      sourceType: "Risk",
      title: "Second risk",
    });
  });

  test("previews Convert to record and link from an exact version before anything is written", async () => {
    const { onConfirmConvert, onPreviewConvert } = renderPanel();
    expect(button(container, "Preview conversion")?.disabled).toBe(true);
    choose("Diagram Version", "version-1");
    choose("Node", "api");
    choose("Target type", "Decision");
    await clickAndSettle(button(container, "Preview conversion"));
    expect(onPreviewConvert).toHaveBeenCalledWith({
      nodeId: "api",
      target: "Decision",
      versionId: "version-1",
      workType: "Task",
    });
    expect(onConfirmConvert).not.toHaveBeenCalled();
  });

  test("the preview shows target, fields, exact version and origin, then confirms the same plan", () => {
    const { onConfirmConvert } = renderPanel({ plan });
    const preview = container.querySelector(
      'section[aria-label="Conversion preview"]',
    ) as HTMLElement;
    for (const text of [
      "Decision",
      "Cantiara",
      "Gateway",
      "Launch · version 1",
      "Platform · Service Gateway",
      "stays unchanged",
    ]) {
      expect(preview.textContent).toContain(text);
    }
    click(button(preview, "Convert to record and link"));
    expect(onConfirmConvert).toHaveBeenCalledWith(plan);
  });

  test("an External Source Link has no version, so nothing can be converted", () => {
    renderPanel({
      diagram: { authorityMode: "External Source Link", id: "diagram-1" },
      versions: [],
    });
    expect(container.textContent).toContain("has no Diagram Version");
    expect(button(container, "Preview conversion")).toBeUndefined();
  });
});
