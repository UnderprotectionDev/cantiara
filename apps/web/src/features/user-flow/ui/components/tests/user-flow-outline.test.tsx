// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The harness closes over its own state.

import type { ScreenReferenceView } from "@cantiara/api/user-flow";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createEditor,
  type EditorDocument,
  type EditorState,
} from "../../../lib/flow-editor";
import { toggleCollapsed } from "../../../lib/flow-outline";
import { UserFlowOutline } from "../user-flow-outline";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SCREEN_ID = "screen-1";
const screens = new Map<string, ScreenReferenceView>([
  [
    SCREEN_ID,
    {
      broken: null,
      openPath: "/projects/p1#screen-screen-1",
      screenId: SCREEN_ID,
      title: "Checkout",
    },
  ],
]);

let sequence = 0;
const createId = () => {
  sequence += 1;
  return `id-${sequence}`;
};

let container: HTMLDivElement;
let root: Root;
let latest: EditorState;

function Harness({ initial }: { initial: EditorDocument }) {
  const [state, setState] = useState(() => createEditor(initial));
  const [collapsed, setCollapsed] = useState<string[]>([]);
  latest = state;
  return (
    <UserFlowOutline
      collapsed={collapsed}
      createId={createId}
      onChange={(change) => setState(change)}
      onToggleCollapse={(id) =>
        setCollapsed((current) => toggleCollapsed(current, id))
      }
      screenOptions={[{ id: SCREEN_ID, title: "Checkout" }]}
      screens={screens}
      state={state}
    />
  );
}

function mount(initial: EditorDocument = { links: [], nodes: [] }) {
  act(() => {
    root.render(<Harness initial={initial} />);
  });
}

function byLabel(label: string) {
  const found = container.querySelector(`[aria-label="${label}"]`);
  if (!found) {
    throw new Error(`No element labelled "${label}"`);
  }
  return found as HTMLElement;
}

function click(label: string) {
  act(() => {
    byLabel(label).click();
  });
}

function setField(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const proto =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

function byId(id: string) {
  return container.querySelector(`#${id}`) as HTMLInputElement &
    HTMLSelectElement;
}

async function submitCreate() {
  await act(async () => {
    (
      container.querySelector('button[type="submit"]') as HTMLButtonElement
    ).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function createNode(kind: string, text: string, screenId?: string) {
  setField(byId("user-flow-outline-kind"), kind);
  if (screenId) {
    setField(byId("user-flow-outline-screen"), screenId);
  }
  setField(byId("user-flow-outline-text"), text);
  await submitCreate();
}

function buttonByText(text: string) {
  const found = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`No button "${text}"`);
  }
  return found as HTMLButtonElement;
}

beforeEach(() => {
  sequence = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("canvas yapılandırılmış outline", () => {
  test("a keyboard and screen reader journey completes every canvas task without a pointer", async () => {
    mount();
    expect(container.textContent).toContain("The outline is empty");

    // create
    await createNode("Action", "Open the app");
    await createNode("Decision", "Has account?");
    await createNode("Screen", "Pays", SCREEN_ID);
    expect(latest.document.nodes.map(({ kind }) => kind)).toEqual([
      "Action",
      "Decision",
      "Screen",
    ]);
    expect(latest.document.nodes[2]?.screenId).toBe(SCREEN_ID);

    // select (a toggle, so a keyboard user builds a multi-selection)
    click("Select Action: Open the app");
    expect(latest.selection).toEqual(["id-1", "id-3"]);
    expect(
      byLabel("Select Action: Open the app").getAttribute("aria-pressed"),
    ).toBe("true");

    // reorder
    click("Move Action: Open the app down");
    expect(latest.document.nodes.map(({ id }) => id)).toEqual([
      "id-2",
      "id-1",
      "id-3",
    ]);
    click("Move Action: Open the app up");
    expect(latest.document.nodes.map(({ id }) => id)).toEqual([
      "id-1",
      "id-2",
      "id-3",
    ]);

    // bind and unbind (the controls open with Inspect, so a long outline stays light)
    click("Inspect Action: Open the app");
    setField(
      byLabel("Bind Action: Open the app to") as HTMLSelectElement,
      "id-2",
    );
    click("Bind Action: Open the app");
    expect(latest.document.links).toMatchObject([{ from: "id-1", to: "id-2" }]);
    click("Unbind Action: Open the app from Decision: Has account?");
    expect(latest.document.links).toEqual([]);

    // inspect
    expect(
      byLabel("Inspect Action: Open the app").getAttribute("aria-expanded"),
    ).toBe("true");
    expect(container.textContent).toContain("Ungrouped");
    click("Inspect Action: Open the app");

    // open source record
    const link = container.querySelector("a");
    expect(link?.textContent).toBe("Open Source Record");
    expect(link?.getAttribute("href")).toBe("/projects/p1#screen-screen-1");

    // group
    click("Select Decision: Has account?");
    expect(latest.selection).toEqual(["id-1", "id-2", "id-3"]);
    act(() => {
      buttonByText("Group selection into Section").click();
    });
    const section = latest.document.nodes.find(
      ({ kind }) => kind === "Section",
    );
    expect(section).toBeDefined();
    expect(
      latest.document.nodes.filter(
        ({ sectionId }) => sectionId === section?.id,
      ),
    ).toHaveLength(3);
  });

  test("groups a selection into a Section and collapses it view-locally", () => {
    mount({
      links: [],
      nodes: [
        {
          id: "a",
          kind: "Action",
          position: { x: 0, y: 0 },
          screenId: null,
          style: "default",
          text: "A",
        },
        {
          id: "b",
          kind: "Action",
          position: { x: 0, y: 200 },
          screenId: null,
          style: "default",
          text: "B",
        },
      ],
    });
    click("Select Action: A");
    click("Select Action: B");
    act(() => {
      buttonByText("Group selection into Section").click();
    });
    const section = latest.document.nodes.find(
      ({ kind }) => kind === "Section",
    );
    expect(section).toBeDefined();
    expect(latest.selection).toEqual([section?.id]);
    const members = latest.document.nodes.filter(({ sectionId }) => sectionId);
    expect(members.length).toBeGreaterThan(0);

    const before = JSON.stringify(latest.document);
    click("Collapse Section");
    expect(container.textContent).toContain("hidden");
    // Collapse is view-local: the document is untouched.
    expect(JSON.stringify(latest.document)).toBe(before);
    expect(
      container.querySelector('[aria-label="Select Action: A"]'),
    ).toBeNull();
    click("Expand Section");
    expect(
      container.querySelector('[aria-label="Select Action: A"]'),
    ).not.toBeNull();
  });

  test("exposes roles, names and states a screen reader needs", () => {
    mount({
      links: [],
      nodes: [
        {
          id: "a",
          kind: "Screen",
          position: { x: 0, y: 0 },
          screenId: SCREEN_ID,
          style: "default",
          text: "Pay",
        },
      ],
    });
    expect(byLabel("Outline").tagName).toBe("SECTION");
    expect(byLabel("Outline nodes").tagName).toBe("UL");
    expect(byLabel("Add a node to the outline").tagName).toBe("FORM");
    for (const control of container.querySelectorAll("button, select, input")) {
      const named =
        control.getAttribute("aria-label") ||
        control.textContent?.trim() ||
        (control.id && container.querySelector(`label[for="${control.id}"]`));
      expect(named, control.outerHTML).toBeTruthy();
    }
    expect(byLabel("Select Screen: Pay").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("a full scene refuses another node instead of overflowing it", async () => {
    const nodes = Array.from({ length: 500 }, (_, index) => ({
      id: `n${index}`,
      kind: "Action" as const,
      position: { x: 0, y: index },
      screenId: null,
      style: "default" as const,
      text: `n${index}`,
    }));
    mount({ links: [], nodes });
    await createNode("Action", "overflow");
    expect(latest.document.nodes).toHaveLength(500);
  });
});
