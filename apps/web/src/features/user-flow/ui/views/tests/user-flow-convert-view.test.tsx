// @vitest-environment happy-dom

import type {
  UserFlowBindView,
  UserFlowConvertPlan,
  UserFlowRebindPlan,
  UserFlowView,
} from "@cantiara/api/user-flow";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ConvertAndBindPreview } from "../../components/convert-and-bind-dialog";
import { RebindPreview } from "../../components/rebind-dialog";
import { CreateFromTemplateForm } from "../../components/user-flow-promote-templates";
import { BindList, LiveCardList } from "../../components/user-flow-records";
import {
  UserFlowDetail,
  type UserFlowDetailTools,
  UserFlowListView,
} from "../user-flow-view";

const placedAt = "2026-10-01T09:00:00.000Z";
const noop = async () => undefined;
const ignore = () => undefined;

const plan: UserFlowConvertPlan = {
  createsScreen: false,
  nodeId: "n1",
  originLocation: { flowVersion: 3, nodeId: "n1", userFlowId: "f1" },
  projectId: "p1",
  record: {
    body: "Tap Pay\nConfirms the total.",
    title: "Tap Pay",
    type: "Decision",
    workType: null,
  },
  recordCount: 1,
  relation: "Origin",
  targetProject: { id: "p1", name: "Cantiara" },
  userFlowId: "f1",
};

function flow(): UserFlowView {
  return {
    cards: [
      {
        id: "c1",
        placedAt,
        position: { x: 0, y: 0 },
        record: {
          broken: null,
          kind: "Work",
          openPath: "/projects/p1#work-w1",
          recordId: "w1",
          status: "Not Started",
          title: "Fix the pay button",
        },
      },
      {
        id: "c2",
        placedAt,
        position: { x: 0, y: 0 },
        record: {
          broken: {
            canOpenSourceRecord: false,
            establishedAt: placedAt,
            reason: "Permanently deleted",
          },
          kind: "Risk",
          openPath: null,
          recordId: "r1",
          status: null,
          title: null,
        },
      },
    ],
    createdAt: placedAt,
    id: "f1",
    links: [],
    nodes: [
      {
        id: "n1",
        kind: "Action",
        placedAt,
        position: { x: 0, y: 0 },
        screen: null,
        sectionId: null,
        style: "default",
        text: "Tap Pay",
      },
      {
        id: "n2",
        kind: "Screen",
        placedAt,
        position: { x: 0, y: 0 },
        screen: {
          broken: null,
          openPath: "/projects/p1#screen-s1",
          screenId: "s1",
          title: "Checkout",
        },
        sectionId: null,
        style: "default",
        text: "",
      },
    ],
    projectId: "p1",
    title: "Purchase path",
    updatedAt: placedAt,
    version: 3,
  };
}

const bind: UserFlowBindView = {
  boundVersion: 2,
  createdAt: placedAt,
  id: "b1",
  node: { kind: "Action", text: "Tap Pay" },
  origin: {
    flowVersion: 2,
    node: { kind: "Action", text: "Tap Pay at origin" },
    nodeId: "n1",
    userFlowId: "f1",
  },
  rebindAvailable: true,
  record: {
    broken: null,
    kind: "Decision",
    openPath: "/projects/p1#source-decision-d1",
    recordId: "d1",
    status: "Valid",
    title: "Use one-tap pay",
  },
  revision: 1,
};

const tools: UserFlowDetailTools = {
  binds: [bind],
  cardRecords: [{ id: "w1", kind: "Work", title: "Fix the pay button" }],
  onConvertConfirm: noop,
  onConvertPreview: () => Promise.resolve(plan),
  onPlaceCard: noop,
  onPreviewRebind: () => Promise.reject(new Error("unused")),
  onPromote: noop,
  onRebind: noop,
  onRemoveCard: noop,
  onSaveTemplate: noop,
};

function renderDetail(withTools: boolean) {
  return renderToStaticMarkup(
    <UserFlowDetail
      flow={flow()}
      onPlaceNode={noop}
      readOnly={false}
      screens={[{ id: "s1", title: "Checkout" }]}
      tools={withTools ? tools : undefined}
    />,
  );
}

test("the Convert and Bind preview shows one record, Origin and the exact Origin Location", () => {
  const html = renderToStaticMarkup(<ConvertAndBindPreview plan={plan} />);
  expect(html).toContain("Confirming creates exactly one Decision");
  expect(html).toContain("Nothing exists until then");
  expect(html).toContain("Target Project");
  expect(html).toContain("Cantiara");
  expect(html).toContain("Tap Pay");
  expect(html).toContain("Origin Location");
  expect(html).toContain("User Flow f1");
  expect(html).toContain("node n1");
  expect(html).toContain("version 3");
  expect(html).toContain("No Screen is created");
  expect(html).not.toContain("Work type");
});

test("the outline offers Convert and Bind on every node and Promote to Screen only on nodes without a Screen", () => {
  const html = renderDetail(true);
  expect(html.match(/Convert and Bind/g)).toHaveLength(2);
  expect(html.match(/Promote to Screen/g)).toHaveLength(1);
  expect(renderDetail(false)).not.toContain("Convert and Bind");
});

test("binds show the immutable Origin Location and Rebind only when a newer version has the node", () => {
  const html = renderToStaticMarkup(
    <BindList binds={[bind]} onRebind={ignore} readOnly={false} />,
  );
  expect(html).toContain("Origin Location: User Flow f1");
  expect(html).toContain("version 2");
  expect(html).toContain("Tap Pay at origin");
  expect(html).toContain("Bound to version 2");
  expect(html).toContain("Rebind");
  const current = renderToStaticMarkup(
    <BindList
      binds={[{ ...bind, rebindAvailable: false }]}
      onRebind={ignore}
      readOnly={false}
    />,
  );
  expect(current).not.toContain("Rebind");
});

test("the Rebind preview keeps the Origin Location fixed", () => {
  const rebind: UserFlowRebindPlan = {
    bindId: "b1",
    bindRevision: 1,
    fromVersion: 2,
    nodeId: "n1",
    originLocation: { flowVersion: 2, nodeId: "n1", userFlowId: "f1" },
    projectId: "p1",
    recordId: "d1",
    recordType: "Decision",
    toVersion: 3,
    userFlowId: "f1",
  };
  const html = renderToStaticMarkup(<RebindPreview plan={rebind} />);
  expect(html).toContain("2 to 3");
  expect(html).toContain("Origin Location stays on version 2");
});

test("live cards are read-only views; a broken card shows no title and no source link", () => {
  const html = renderToStaticMarkup(
    <LiveCardList cards={flow().cards} onRemove={noop} readOnly={false} />,
  );
  expect(html).toContain("Fix the pay button");
  expect(html).toContain("Open Source Record");
  expect(html).toContain("Broken — Permanently deleted");
  expect(html.match(/Open Source Record/g)).toHaveLength(1);
  expect(html.match(/Remove card/g)).toHaveLength(2);
  // No editable field of the source record is rendered.
  expect(html).not.toContain("<input");
  expect(html).not.toContain("<textarea");
});

test("the detail view exposes Place live card and Save as template", () => {
  const html = renderDetail(true);
  expect(html).toContain("Place live card");
  expect(html).toContain("Save as template");
});

test("Create from template appears only when a template exists", () => {
  const empty = renderToStaticMarkup(
    <UserFlowListView
      flows={[]}
      onCreate={noop}
      onCreateFromTemplate={noop}
      onSelect={ignore}
      readOnly={false}
      selected={null}
      selectedId={null}
      templates={[]}
    />,
  );
  expect(empty).not.toContain("Create from template");
  const html = renderToStaticMarkup(
    <CreateFromTemplateForm
      onCreate={noop}
      readOnly={false}
      templates={[
        {
          createdAt: placedAt,
          id: "t1",
          name: "Checkout skeleton",
          structure: { links: [], nodes: [] },
        },
      ]}
    />,
  );
  expect(html).toContain("Create from template");
  expect(html).toContain("Checkout skeleton");
});
