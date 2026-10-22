// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The harness closes over its own state.
import type {
  ProjectWallCardView,
  ProjectWallLinkView,
} from "@cantiara/api/project-wall";
import { toggleCollapsedGroup } from "@cantiara/api/project-wall-viewport";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ProjectWallOutline,
  type ProjectWallOutlineProps,
} from "../project-wall-outline";
import type { ProjectWallSceneWall } from "../project-wall-scene";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = "2026-10-20T09:00:00.000Z";
let container: HTMLDivElement;
let root: Root;
let latest: {
  collapsed: string[];
  selection: string[];
  wall: Pick<ProjectWallSceneWall, "cards" | "groups" | "links">;
};
let linkSequence = 0;
let groupSequence = 0;

function card(index: number, overrides: Partial<ProjectWallCardView> = {}) {
  return {
    density: "Preview",
    fields: [],
    groupId: null,
    highlight: null,
    id: `card-${index}`,
    locked: false,
    placedAt: NOW,
    position: { x: index * 300, y: 0 },
    preview: null,
    sharedSource: false,
    source: {
      broken: null,
      kind: "Work",
      openPath: `/projects/p1#work-w${index}`,
      recordId: `w${index}`,
      status: "In Progress",
      title: `Record ${index}`,
    },
    sourceType: "Work",
    ...overrides,
  } satisfies ProjectWallCardView;
}

type Wall = Pick<ProjectWallSceneWall, "cards" | "groups" | "links">;

function Harness({ initial }: { initial: Wall }) {
  const [wall, setWall] = useState(initial);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  latest = { collapsed, selection, wall };
  const patch = (cardId: string, change: Partial<ProjectWallCardView>) =>
    setWall((current) => ({
      ...current,
      cards: current.cards.map((entry) =>
        entry.id === cardId ? { ...entry, ...change } : entry,
      ),
    }));
  const props: ProjectWallOutlineProps = {
    actions: {
      onDrawLink: (input) => {
        linkSequence += 1;
        const link: ProjectWallLinkView = {
          fromCardId: input.fromCardId,
          id: `link-${linkSequence}`,
          label: input.label,
          toCardId: input.toCardId,
        };
        setWall((current) => ({ ...current, links: [...current.links, link] }));
        return Promise.resolve(true);
      },
      onGroupSelection: (title, cardIds) => {
        groupSequence += 1;
        const id = `group-${groupSequence}`;
        setWall((current) => ({
          ...current,
          cards: current.cards.map((entry) =>
            cardIds.includes(entry.id) ? { ...entry, groupId: id } : entry,
          ),
          groups: [...current.groups, { collapsed: true, id, title }],
        }));
        return Promise.resolve(true);
      },
      onReorder: (cardIds) =>
        setWall((current) => ({
          ...current,
          cards: cardIds.flatMap((id) => {
            const found = current.cards.find((entry) => entry.id === id);
            return found ? [found] : [];
          }),
        })),
      onUnbindLink: (linkId) => {
        setWall((current) => ({
          ...current,
          links: current.links.filter(({ id }) => id !== linkId),
        }));
        return Promise.resolve(true);
      },
    },
    cardActions: {
      onDensity: (cardId, density) => patch(cardId, { density }),
      onGroup: (cardId, groupId) => patch(cardId, { groupId }),
      onHighlight: (cardId, highlight) => patch(cardId, { highlight }),
      onLock: (cardId, locked) => patch(cardId, { locked }),
      onRemove: (cardId) =>
        setWall((current) => ({
          ...current,
          cards: current.cards.filter(({ id }) => id !== cardId),
        })),
    },
    collapsed,
    onSelectionChange: setSelection,
    onToggleGroup: (groupId) =>
      setCollapsed((current) => toggleCollapsedGroup(current, groupId)),
    selection,
    wall,
  };
  return <ProjectWallOutline {...props} />;
}

function mount(initial: Wall) {
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
  act(() => byLabel(label).click());
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

function buttonByText(text: string) {
  const found = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`No button "${text}"`);
  }
  return found as HTMLButtonElement;
}

function field(label: string) {
  const labelEl = [...container.querySelectorAll("label")].find(
    (entry) => entry.textContent?.trim() === label,
  );
  const found = labelEl?.htmlFor
    ? container.querySelector(`[id="${labelEl.htmlFor}"]`)
    : null;
  if (!found) {
    throw new Error(`No field "${label}"`);
  }
  return found as HTMLInputElement & HTMLSelectElement;
}

function titles() {
  return latest.wall.cards.map((entry) => entry.source.title);
}

function wallOf(count: number): Wall {
  return {
    cards: Array.from({ length: count }, (_, index) => card(index)),
    groups: [],
    links: [],
  };
}

beforeEach(() => {
  linkSequence = 0;
  groupSequence = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("canvas yapılandırılmış outline: tasks without a pointer", () => {
  test("selects cards from buttons", () => {
    mount(wallOf(3));
    click("Select: Record 1");
    click("Select: Record 2");
    expect(latest.selection).toEqual(["card-1", "card-2"]);
    expect(byLabel("Select: Record 1").getAttribute("aria-pressed")).toBe(
      "true",
    );
    click("Select: Record 1");
    expect(latest.selection).toEqual(["card-2"]);
  });

  test("reorders with Move up and Move down inside the Outline", () => {
    mount(wallOf(3));
    click("Move down: Record 0");
    expect(titles()).toEqual(["Record 1", "Record 0", "Record 2"]);
    click("Move up: Record 2");
    expect(titles()).toEqual(["Record 1", "Record 2", "Record 0"]);
    // An edge card has nowhere to go.
    click("Move up: Record 1");
    expect(titles()).toEqual(["Record 1", "Record 2", "Record 0"]);
  });

  test("groups the selection, assigns a card to a group and collapses it", async () => {
    mount(wallOf(3));
    click("Select: Record 0");
    click("Select: Record 1");
    setField(field("Group name"), "Onboarding");
    await act(async () => buttonByText("Group selection").click());
    expect(latest.wall.groups.map(({ title }) => title)).toEqual([
      "Onboarding",
    ]);
    expect(latest.wall.cards.map(({ groupId }) => groupId)).toEqual([
      "group-1",
      "group-1",
      null,
    ]);

    setField(byLabel("Group: Record 2") as HTMLSelectElement, "group-1");
    expect(
      latest.wall.cards.every(({ groupId }) => groupId === "group-1"),
    ).toBe(true);

    click("Collapse group: Onboarding");
    expect(latest.collapsed).toEqual(["group-1"]);
    expect(
      container.querySelector('[aria-label="Select: Record 0"]'),
    ).toBeNull();
    click("Expand group: Onboarding");
    expect(latest.collapsed).toEqual([]);
    expect(
      container.querySelector('[aria-label="Select: Record 0"]'),
    ).not.toBeNull();
  });

  test("binds a Visual link from the inspector and unbinds it", async () => {
    mount(wallOf(3));
    click("Inspect: Record 0");
    expect(container.textContent).toContain("From: Record 0");
    setField(field("To"), "card-2");
    setField(field("Label"), "leads to");
    await act(async () => buttonByText("Bind").click());
    expect(latest.wall.links).toEqual([
      {
        fromCardId: "card-0",
        id: "link-1",
        label: "leads to",
        toCardId: "card-2",
      },
    ]);
    expect(container.textContent).toContain("From: Record 0 To: Record 2");
    click("Unbind: leads to");
    expect(latest.wall.links).toEqual([]);
  });

  test("inspects a card and opens its source record", () => {
    mount(wallOf(2));
    click("Inspect: Record 1");
    const inspector = byLabel("Inspector: Record 1");
    expect(inspector.textContent).toContain("Lock Position");
    const open = byLabel("Open Source Record: Record 1") as HTMLAnchorElement;
    expect(open.getAttribute("href")).toBe("/projects/p1#work-w1");
    act(() =>
      [...inspector.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Lock Position")
        ?.click(),
    );
    expect(latest.wall.cards[1]?.locked).toBe(true);
  });

  test("a broken source offers no Open Source Record", () => {
    mount({
      cards: [
        card(0, {
          source: {
            broken: {
              canOpenSourceRecord: false,
              establishedAt: NOW,
              reason: "Permanently deleted",
            },
            kind: "Work",
            openPath: null,
            recordId: "w0",
            status: null,
            title: "Record 0",
          },
        }),
      ],
      groups: [],
      links: [],
    });
    expect(
      container.querySelector('[aria-label^="Open Source Record"]'),
    ).toBeNull();
  });

  test("moves focus between rows with the arrow keys", () => {
    mount(wallOf(3));
    const first = byLabel("Select: Record 0");
    first.focus();
    act(() => {
      first.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      );
    });
    expect(document.activeElement).toBe(byLabel("Select: Record 1"));
  });
});

describe("Outline at scale", () => {
  test("a small wall renders every row", () => {
    mount(wallOf(100));
    expect(
      container.querySelector("[data-virtualized='false']"),
    ).not.toBeNull();
    expect(container.querySelectorAll("[data-outline-index]")).toHaveLength(
      100,
    );
  });

  test("a large wall virtualizes and still reaches every card through data", () => {
    mount(wallOf(2000));
    expect(container.querySelector("[data-virtualized='true']")).not.toBeNull();
    const mounted = container.querySelectorAll("[data-outline-index]").length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(200);
    expect(latest.wall.cards).toHaveLength(2000);
  });
});
