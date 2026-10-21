import {
  neutralViewport,
  type WireframeViewport,
} from "@cantiara/api/screen-viewport";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
  wireframeDocumentSchema,
} from "@cantiara/api/wireframe-document";
import { describe, expect, test } from "vitest";

import { ScreenNotFoundError } from "../screens";
import { accountId, createMemoryStore } from "../screens-memory-store";

const saved: WireframeViewport = {
  centerX: 640,
  centerY: 400,
  collapsedGroups: ["Card"],
  zoom: 1.5,
};
const otherAccountId = "account-2";

describe("Personal viewport on a Screen's Wireframe canvas", () => {
  async function setup() {
    const harness = createMemoryStore();
    const record = await harness.screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    return { ...harness, record };
  }

  function address(screenId: string) {
    return { projectId: "project-1", screenId };
  }

  test("restores the last centre, zoom and view-local collapse across sessions", async () => {
    const { record, screens } = await setup();

    expect(await screens.viewport(accountId, address(record.id))).toEqual({
      viewport: null,
    });
    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: saved,
    });

    expect(await screens.viewport(accountId, address(record.id))).toEqual({
      viewport: saved,
    });
  });

  test("belongs to this account and this Screen only", async () => {
    const { record, screens } = await setup();
    const second = await screens.create(accountId, {
      projectId: "project-1",
      title: "Settings",
    });
    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: saved,
    });

    expect(await screens.viewport(accountId, address(second.id))).toEqual({
      viewport: null,
    });
    // Another account has no project access and never reads this view.
    await expect(
      screens.viewport(otherAccountId, address(record.id)),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });

  test("is not written into the Wireframe document, versions or the Screen record", async () => {
    const { record, screens, stored } = await setup();
    const document = {
      ...createEmptyWireframeDocument(),
      blocks: [createWireframeBlock("Card", "c1", { x: 0, y: 0 })],
    };
    await screens.saveWireframe(accountId, {
      ...address(record.id),
      document,
    });
    const before = structuredClone(stored.get(record.id));
    const listBefore = JSON.stringify(
      await screens.list(accountId, "project-1"),
    );

    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: saved,
    });

    expect(stored.get(record.id)).toEqual(before);
    expect(JSON.stringify(await screens.list(accountId, "project-1"))).toBe(
      listBefore,
    );
    const wireframe = await screens.wireframe(accountId, address(record.id));
    expect(JSON.stringify(wireframe)).not.toContain("collapsedGroups");
    expect(Object.keys(wireframe)).not.toContain("viewport");
  });

  test("the document schema refuses a viewport, selection or any view state", () => {
    const document = createEmptyWireframeDocument();
    for (const smuggled of [
      { viewport: saved },
      { selection: ["c1"] },
      { collapsedGroups: ["Card"] },
    ]) {
      expect(
        wireframeDocumentSchema.safeParse({ ...document, ...smuggled }).success,
      ).toBe(false);
    }
  });

  test("only centre, zoom and collapse are accepted; selection and edit state are not", async () => {
    const { record, screens } = await setup();

    const extras = [
      { selection: ["c1"] },
      { inspectorOpen: true },
      { editing: "c1" },
      { hover: "c1" },
      { unsavedOps: [] },
    ];
    await Promise.all(
      extras.map((extra) =>
        expect(
          screens.saveViewport(accountId, {
            ...address(record.id),
            viewport: { ...saved, ...extra } as WireframeViewport,
          }),
        ).rejects.toThrow(),
      ),
    );
    expect(await screens.viewport(accountId, address(record.id))).toEqual({
      viewport: null,
    });
  });

  test("rejects NaN, infinite and absurd positions at the boundary", async () => {
    const { record, screens } = await setup();

    const broken = [
      { ...saved, centerX: Number.NaN },
      { ...saved, centerY: Number.POSITIVE_INFINITY },
      { ...saved, zoom: 0 },
      { ...saved, zoom: 40 },
    ];
    await Promise.all(
      broken.map((viewport) =>
        expect(
          screens.saveViewport(accountId, { ...address(record.id), viewport }),
        ).rejects.toThrow(),
      ),
    );
  });

  test("a Screen in Trash has no readable or writable viewport", async () => {
    const { record, screens } = await setup();
    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: neutralViewport({ height: 800, width: 1280 }),
    });
    await screens.setLifecycle(accountId, {
      action: "trash",
      expectedRevision: record.revision,
      projectId: "project-1",
      screenId: record.id,
    });

    await expect(
      screens.viewport(accountId, address(record.id)),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
    await expect(
      screens.saveViewport(accountId, {
        ...address(record.id),
        viewport: saved,
      }),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });
});
