// @vitest-environment happy-dom

import type { UserFlowView } from "@cantiara/api/user-flow";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { UserFlowDetail, UserFlowListView } from "../user-flow-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const placedAt = "2026-10-01T09:00:00.000Z";
const FOREIGN_SURFACES = /Lifeline|Moodboard|Project Wall|Technical Sequence/;
const noop = async () => undefined;
const ignore = () => undefined;

function flow(screen: UserFlowView["nodes"][number]["screen"]): UserFlowView {
  return {
    cards: [],
    createdAt: placedAt,
    id: "f1",
    links: [],
    nodes: [
      {
        id: "n1",
        kind: "Screen",
        placedAt,
        position: { x: 0, y: 0 },
        screen,
        sectionId: null,
        style: "default",
        text: "User pays",
      },
    ],
    projectId: "p1",
    title: "Purchase path",
    updatedAt: placedAt,
    version: 2,
  };
}

function render(view: UserFlowView) {
  return renderToStaticMarkup(
    <UserFlowDetail
      flow={view}
      onPlaceNode={noop}
      readOnly={false}
      screens={[{ id: "s1", title: "Checkout" }]}
    />,
  );
}

test("a resolved Screen node shows the live title and opens the source", () => {
  const html = render(
    flow({
      broken: null,
      openPath: "/projects/p1#screen-s1",
      screenId: "s1",
      title: "Checkout",
    }),
  );
  expect(html).toContain("Checkout");
  expect(html).toContain("User pays");
  expect(html).toContain("Open Source Record");
  expect(html).toContain('href="/projects/p1#screen-s1"');
});

test("an Archived Screen shows Archived and still opens the source", () => {
  const html = render(
    flow({
      broken: {
        canOpenSourceRecord: true,
        establishedAt: placedAt,
        reason: "Archived",
      },
      openPath: "/projects/p1#screen-s1",
      screenId: "s1",
      title: "Checkout",
    }),
  );
  expect(html).toContain("Archived");
  expect(html).not.toContain("Broken —");
  expect(html).toContain("Open Source Record");
});

test("a broken target shows its reason without a title and cannot open", () => {
  const html = render(
    flow({
      broken: {
        canOpenSourceRecord: false,
        establishedAt: placedAt,
        reason: "Permanently deleted",
      },
      openPath: null,
      screenId: "s1",
      title: null,
    }),
  );
  expect(html).toContain("Broken — Permanently deleted");
  expect(html).toContain(placedAt);
  expect(html).not.toContain("Open Source Record");
  expect(html).not.toContain("Checkout</p>");
});

test("a User Flow with no nodes offers Place node with the closed type set", () => {
  const html = render({ ...flow(null), nodes: [] });
  expect(html).toContain("Place node");
  for (const kind of [
    "Screen",
    "Action",
    "Decision",
    "State/Outcome",
    "Section",
  ]) {
    expect(html).toContain(`>${kind}</option>`);
  }
  expect(html).not.toContain("Lifeline");
});

test("the node type picker offers only the closed semantic set", () => {
  const html = render(flow(null));
  const options = [...html.matchAll(/<option[^>]*value="([^"]*)"/g)].map(
    ([, value]) => value,
  );
  expect(options.filter((value) => value !== "" && value !== "s1")).toEqual([
    "Screen",
    "Action",
    "Decision",
    "State/Outcome",
    "Section",
  ]);
  expect(html).not.toMatch(FOREIGN_SURFACES);
});

test("the list view is labelled User Flow", () => {
  const html = renderToStaticMarkup(
    <UserFlowListView
      flows={[]}
      onCreate={noop}
      onSelect={ignore}
      readOnly={false}
      selected={null}
      selectedId={null}
    />,
  );
  expect(html).toContain("User Flow");
  expect(html).toContain("Create User Flow");
});
