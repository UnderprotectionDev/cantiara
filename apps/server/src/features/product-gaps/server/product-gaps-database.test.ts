// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { productGap, productGapLink } from "@cantiara/db/schema/product-gap";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  ProductGapFollowUpStaleError,
  ProductGapLinkTargetError,
  ProductGapNotFoundError,
  ProductGapProjectReadOnlyError,
  ProductGapStatusConflictError,
  ProductGapWorkspaceNotFoundError,
} from "./product-gaps";
import { createDatabaseProductGaps } from "./product-gaps-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Product Gaps PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `product-gaps-${suffix}`;
  const otherAccountId = `product-gaps-other-${suffix}`;
  const noWorkspaceAccountId = `product-gaps-none-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const otherWorkspaceId = `workspace-other-${suffix}`;
  const projectId = `project-${suffix}`;
  const archivedProjectId = `project-archived-${suffix}`;
  const otherProjectId = `project-other-${suffix}`;
  const ids = {
    decision: `decision-${suffix}`,
    feature: `feature-${suffix}`,
    otherFeature: `other-feature-${suffix}`,
    otherWork: `other-work-${suffix}`,
    task: `task-${suffix}`,
    trashedFeature: `trashed-feature-${suffix}`,
  };
  const gap = {
    title: "Bulk edit across projects",
    unmetNeed: "I edit many Works in another tool.",
  };

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
      {
        email: `${noWorkspaceAccountId}@example.invalid`,
        id: noWorkspaceAccountId,
        name: "Nobody",
      },
    ]);
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    const base = { starterConfiguration: "Blank Project" as const };
    await db.insert(project).values([
      {
        ...base,
        id: projectId,
        name: "Checkout",
        shortCode: `CHK-${suffix.toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        archivedAt: new Date(),
        id: archivedProjectId,
        name: "Archived",
        shortCode: `ARC-${suffix.toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        id: otherProjectId,
        name: "Other",
        shortCode: `OTH-${suffix.toUpperCase()}`,
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db.insert(work).values([
      {
        id: ids.task,
        key: `CHK-${suffix.toUpperCase()}-1`,
        number: 1,
        projectId,
        title: "Fix export",
        type: "Task",
      },
      {
        id: ids.feature,
        key: `CHK-${suffix.toUpperCase()}-2`,
        number: 2,
        projectId,
        title: "Offline mode",
        type: "Feature",
      },
      {
        id: ids.trashedFeature,
        key: `CHK-${suffix.toUpperCase()}-3`,
        number: 3,
        projectId,
        title: "Trashed feature",
        trashedAt: new Date(),
        type: "Feature",
      },
      {
        id: ids.otherWork,
        key: `OTH-${suffix.toUpperCase()}-1`,
        number: 1,
        projectId: otherProjectId,
        title: "Other task",
        type: "Task",
      },
      {
        id: ids.otherFeature,
        key: `OTH-${suffix.toUpperCase()}-2`,
        number: 2,
        projectId: otherProjectId,
        title: "Other feature",
        type: "Feature",
      },
    ]);
    await db.insert(decision).values({
      decision: "Use CSV",
      id: ids.decision,
      projectId,
      title: "Use CSV",
    });
  });

  afterEach(async () => {
    const db = requireDatabase();
    for (const id of [accountId, otherAccountId, noWorkspaceAccountId]) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("records a Workspace Gap with every related family and reads each live", async () => {
    const access = createDatabaseProductGaps(requireDatabase());

    const created = await access.record(accountId, {
      ...gap,
      links: [
        { targetId: projectId, targetType: "Project" },
        { targetId: ids.task, targetType: "Work" },
        { targetId: ids.feature, targetType: "Feature" },
        { targetId: ids.decision, targetType: "Decision" },
      ],
      scope: "Board view only.",
    });

    expect(created.status).toBe("Open");
    expect(
      created.links.map(({ label, targetType }) => [targetType, label]),
    ).toEqual([
      ["Project", "Checkout"],
      ["Work", "Fix export"],
      ["Feature", "Offline mode"],
      ["Decision", "Use CSV"],
    ]);
    expect((await access.list(accountId)).gaps).toEqual([created]);
    expect((await access.list(otherAccountId)).gaps).toEqual([]);
  });

  test("refuses links outside this Workspace, of the wrong family or hidden, writing nothing", async () => {
    const access = createDatabaseProductGaps(requireDatabase());

    for (const link of [
      { targetId: otherProjectId, targetType: "Project" },
      { targetId: ids.otherWork, targetType: "Work" },
      { targetId: ids.task, targetType: "Feature" },
      { targetId: ids.feature, targetType: "Work" },
      { targetId: ids.trashedFeature, targetType: "Feature" },
      { targetId: "missing", targetType: "Decision" },
    ] as const) {
      await expect(
        access.record(accountId, { ...gap, links: [link] }),
      ).rejects.toBeInstanceOf(ProductGapLinkTargetError);
    }
    await expect(
      access.record(noWorkspaceAccountId, gap),
    ).rejects.toBeInstanceOf(ProductGapWorkspaceNotFoundError);
    expect(await requireDatabase().select().from(productGap)).toEqual([]);
  });

  test("never merges similar titles", async () => {
    const access = createDatabaseProductGaps(requireDatabase());

    await access.record(accountId, gap);
    await access.record(accountId, gap);
    await access.record(accountId, { ...gap, title: gap.title.toUpperCase() });

    expect((await access.list(accountId)).gaps).toHaveLength(3);
  });

  test("changes status through the matrix and writes the Gap row alone", async () => {
    const db = requireDatabase();
    const access = createDatabaseProductGaps(db);
    const created = await access.record(accountId, {
      ...gap,
      links: [
        { targetId: projectId, targetType: "Project" },
        { targetId: ids.task, targetType: "Work" },
        { targetId: ids.feature, targetType: "Feature" },
        { targetId: ids.decision, targetType: "Decision" },
      ],
    });
    const before = {
      decisions: await db.select().from(decision),
      links: await db.select().from(productGapLink),
      projects: await db.select().from(project),
      works: await db.select().from(work),
    };

    const met = await access.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: created.id,
      status: "Met",
    });
    const bounded = await access.setStatus(accountId, {
      expectedStatus: "Met",
      gapId: created.id,
      status: "Conscious boundary",
    });

    expect(met.status).toBe("Met");
    expect(bounded.status).toBe("Conscious boundary");
    expect(bounded.links).toEqual(created.links);
    expect({
      decisions: await db.select().from(decision),
      links: await db.select().from(productGapLink),
      projects: await db.select().from(project),
      works: await db.select().from(work),
    }).toEqual(before);
    await expect(
      access.setStatus(accountId, {
        expectedStatus: "Open",
        gapId: created.id,
        status: "Evaluating",
      }),
    ).rejects.toBeInstanceOf(ProductGapStatusConflictError);
    await expect(
      access.setStatus(otherAccountId, {
        expectedStatus: "Conscious boundary",
        gapId: created.id,
        status: "Open",
      }),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
  });

  test("rejects a status outside the closed catalog at the database", async () => {
    const db = requireDatabase();
    const access = createDatabaseProductGaps(db);
    const created = await access.record(accountId, gap);

    await expect(
      db
        .update(productGap)
        .set({ status: "Won't fix" })
        .where(eq(productGap.id, created.id)),
    ).rejects.toThrow();
  });

  test("creates one follow-up Work once, retries to the same result and leaves the Gap as it was", async () => {
    const db = requireDatabase();
    const access = createDatabaseProductGaps(db);
    const created = await access.record(accountId, gap);
    const plan = await access.previewFollowUp(accountId, {
      gapId: created.id,
      kind: "Work",
      projectId,
    });
    expect(
      await db.select().from(work).where(eq(work.title, gap.title)),
    ).toEqual([]);
    const workId = `follow-up-${suffix}`;
    const confirmation = {
      baseRevision: 0,
      clientIdempotencyKey: `key-${suffix}`,
      gapId: created.id,
      id: `link-${suffix}`,
      plan,
      workId,
    };

    const first = await access.confirmFollowUp(accountId, confirmation);
    const retry = await access.confirmFollowUp(accountId, confirmation);

    expect(first.followUp.workKey).toBe(`CHK-${suffix.toUpperCase()}-1`);
    expect(retry.followUp).toEqual(first.followUp);
    expect(first.gap).toMatchObject({
      links: [{ kind: "Follow-up", label: gap.title, targetType: "Work" }],
      status: "Open",
      title: gap.title,
    });
    expect(
      await db.select().from(work).where(eq(work.title, gap.title)),
    ).toHaveLength(1);
  });

  test("relates an existing Feature after preview and writes no Work", async () => {
    const db = requireDatabase();
    const access = createDatabaseProductGaps(db);
    const created = await access.record(accountId, gap);
    const worksBefore = await db.select().from(work);
    const plan = await access.previewFollowUp(accountId, {
      featureId: ids.feature,
      gapId: created.id,
      kind: "Feature relation",
    });

    const confirmed = await access.confirmFollowUp(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: `feature-key-${suffix}`,
      gapId: created.id,
      id: `feature-link-${suffix}`,
      plan,
    });

    expect(confirmed.gap.links).toMatchObject([
      { kind: "Follow-up", label: "Offline mode", targetType: "Feature" },
    ]);
    expect(await db.select().from(work)).toEqual(worksBefore);
  });

  test("refuses a changed plan, a foreign or archived Project and a foreign Feature", async () => {
    const access = createDatabaseProductGaps(requireDatabase());
    const created = await access.record(accountId, gap);
    const plan = await access.previewFollowUp(accountId, {
      gapId: created.id,
      kind: "Work",
      projectId,
    });

    await expect(
      access.confirmFollowUp(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: `stale-${suffix}`,
        gapId: created.id,
        id: `stale-link-${suffix}`,
        plan:
          plan.kind === "Work"
            ? { ...plan, work: { ...plan.work, title: "Edited" } }
            : plan,
        workId: `stale-work-${suffix}`,
      }),
    ).rejects.toBeInstanceOf(ProductGapFollowUpStaleError);
    await expect(
      access.previewFollowUp(accountId, {
        gapId: created.id,
        kind: "Work",
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(ProductGapProjectReadOnlyError);
    for (const target of [
      { kind: "Work", projectId: otherProjectId },
      { featureId: ids.otherFeature, kind: "Feature relation" },
      { featureId: ids.trashedFeature, kind: "Feature relation" },
    ] as const) {
      await expect(
        access.previewFollowUp(accountId, { gapId: created.id, ...target }),
      ).rejects.toThrow();
    }
    await expect(
      access.previewFollowUp(otherAccountId, {
        gapId: created.id,
        kind: "Work",
        projectId: otherProjectId,
      }),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
  });
});
