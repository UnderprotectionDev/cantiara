// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import {
  productGap,
  productGapLink,
  toolEscape,
  toolEscapeClose,
  toolEscapeCloseRecord,
} from "@cantiara/db/schema/product-gap";
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
  ToolEscapeAlreadyClosedError,
  ToolEscapeCloseRefusedError,
  ToolEscapeSourceError,
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
    await db
      .update(project)
      .set({ workCount: 3 })
      .where(eq(project.id, projectId));
    await db
      .update(project)
      .set({ workCount: 2 })
      .where(eq(project.id, otherProjectId));
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
      (async () => {
        await db
          .update(productGap)
          .set({ status: "Won't fix" })
          .where(eq(productGap.id, created.id));
      })(),
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

    expect(first.followUp.workKey).toBe(`CHK-${suffix.toUpperCase()}-4`);
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

  test("records dated Tool Escapes, attaches by choice, derives the count and filters", async () => {
    const db = requireDatabase();
    const access = createDatabaseProductGaps(db);
    const base = {
      intendedJob: "Bulk rename forty Works",
      occurredAt: "2026-10-01T09:30:00.000Z",
      tool: "Spreadsheet",
    };

    const first = await access.recordToolEscape(accountId, {
      escape: {
        ...base,
        note: "Needed a sort of its own.",
        reasons: ["Missing capability", "Faster"],
        source: { targetId: ids.task, targetType: "Work" },
      },
      gap: { kind: "New", ...gap },
    });
    const second = await access.recordToolEscape(accountId, {
      escape: {
        ...base,
        occurredAt: "2026-10-02T09:30:00.000Z",
        reasons: ["Habit"],
        source: { targetId: projectId, targetType: "Project" },
        tool: "Notes App",
      },
      gap: { gapId: first.gap.id, kind: "Existing" },
    });
    // The same title is a separate Gap: nothing is merged.
    const same = await access.recordToolEscape(accountId, {
      escape: {
        ...base,
        reasons: ["Usability"],
        source: { targetId: ids.decision, targetType: "Decision" },
      },
      gap: { kind: "New", ...gap },
    });

    expect(first.escape).toMatchObject({
      note: "Needed a sort of its own.",
      reasons: ["Missing capability", "Faster"],
      source: { label: "Fix export", projectId, state: "resolved" },
    });
    expect(second.gap).toMatchObject({ escapeCount: 2, id: first.gap.id });
    expect(same.gap.id).not.toBe(first.gap.id);
    expect(
      (await access.listEscapes(accountId, { gapId: first.gap.id })).map(
        ({ id }) => id,
      ),
    ).toEqual([second.escape.id, first.escape.id]);
    expect(
      (await access.list(accountId, { tool: "notes app" })).gaps.map(
        ({ id, escapeCount }) => [id, escapeCount],
      ),
    ).toEqual([[first.gap.id, 1]]);
    expect(
      (await access.list(accountId, { reason: "Usability" })).gaps.map(
        ({ id }) => id,
      ),
    ).toEqual([same.gap.id]);
    expect(
      (await access.list(accountId, { projectId })).gaps
        .map(({ id }) => id)
        .sort(),
    ).toEqual([first.gap.id, same.gap.id].sort());
    expect((await access.list(accountId, { status: "Met" })).gaps).toEqual([]);
    expect((await access.list(otherAccountId)).gaps).toEqual([]);

    // A status change rewrites no event; a foreign Gap or source is refused.
    const before = await db.select().from(toolEscape);
    await access.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: first.gap.id,
      status: "Conscious boundary",
    });
    expect(await db.select().from(toolEscape)).toEqual(before);
    await expect(
      access.recordToolEscape(accountId, {
        escape: {
          ...base,
          reasons: ["Faster"],
          source: { targetId: ids.otherWork, targetType: "Work" },
        },
        gap: { kind: "New", ...gap },
      }),
    ).rejects.toBeInstanceOf(ToolEscapeSourceError);
    await expect(
      access.recordToolEscape(otherAccountId, {
        escape: {
          ...base,
          reasons: ["Faster"],
          source: { targetId: otherProjectId, targetType: "Project" },
        },
        gap: { gapId: first.gap.id, kind: "Existing" },
      }),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
    expect(await db.select().from(toolEscape)).toHaveLength(3);
  }, 30_000);

  test("the database refuses an event with no reason, an unknown reason or an unknown source type", async () => {
    const db = requireDatabase();
    const access = createDatabaseProductGaps(db);
    const created = await access.record(accountId, gap);
    const row = {
      gapId: created.id,
      intendedJob: "Job",
      occurredAt: new Date(),
      projectId,
      sourceId: projectId,
      sourceType: "Project",
      tool: "Tool",
    };

    for (const bad of [
      { reasons: [] },
      { reasons: ["Cheaper"] },
      { reasons: ["Faster"], sourceType: "Contact" },
    ]) {
      await expect(
        (async () => {
          await db.insert(toolEscape).values({
            ...row,
            id: crypto.randomUUID(),
            ...bad,
          });
        })(),
      ).rejects.toThrow();
    }
  });

  describe("high-impact close", () => {
    const build = "build-test";
    const proof = {
      currentCandidate: () => Promise.resolve(build),
      workflowRun: (runRef: string) =>
        Promise.resolve(
          runRef === "run-ok"
            ? {
                build,
                records: [{ targetId: ids.task, targetType: "Work" as const }],
                succeeded: true,
              }
            : null,
        ),
    };
    const closeInput = (escapeId: string) => ({
      candidate: { build },
      escapeId,
      externalCopy: { how: "Spreadsheet archived.", state: "Closed" as const },
      impact: "Lasting parallel source of truth" as const,
      restore: {
        method: "Manual recreate" as const,
        records: [{ targetId: ids.task, targetType: "Work" as const }],
      },
      workflow: { runRef: "run-ok" },
    });

    async function recordEscape(
      access: ReturnType<typeof createDatabaseProductGaps>,
    ) {
      return await access.recordToolEscape(accountId, {
        escape: {
          intendedJob: "Keep the plan",
          occurredAt: "2026-10-01T09:30:00.000Z",
          reasons: ["Missing capability"],
          source: { targetId: projectId, targetType: "Project" },
          tool: "Spreadsheet",
        },
        gap: { kind: "New", ...gap },
      });
    }

    test("refuses a missing condition, then appends one bound close and refuses a second", async () => {
      const db = requireDatabase();
      const access = createDatabaseProductGaps(db, proof);
      const { escape: closable } = await recordEscape(access);

      await expect(
        access.closeToolEscape(accountId, {
          ...closeInput(closable.id),
          externalCopy: { how: "Still used.", state: "Active parallel source" },
        }),
      ).rejects.toBeInstanceOf(ToolEscapeCloseRefusedError);
      expect(await db.select().from(toolEscapeClose)).toHaveLength(0);

      const closed = await access.closeToolEscape(
        accountId,
        closeInput(closable.id),
      );
      expect(closed.close).toMatchObject({
        candidateBuild: build,
        records: [{ label: "Fix export", state: "resolved" }],
        workflowRef: "run-ok",
      });
      await expect(
        access.closeToolEscape(accountId, closeInput(closable.id)),
      ).rejects.toBeInstanceOf(ToolEscapeAlreadyClosedError);
      expect(await db.select().from(toolEscapeCloseRecord)).toHaveLength(1);
      const [event] = await db
        .select()
        .from(toolEscape)
        .where(eq(toolEscape.id, closable.id));
      expect(event?.intendedJob).toBe("Keep the plan");
      expect(
        (await access.listEscapes(accountId, { gapId: closable.gapId }))[0]
          ?.close?.id,
      ).toBe(closed.close?.id);
    });

    test("fails closed with no verifier and never closes another Workspace's escape", async () => {
      const db = requireDatabase();
      const access = createDatabaseProductGaps(db, proof);
      const { escape: closable } = await recordEscape(access);

      await expect(
        createDatabaseProductGaps(db).closeToolEscape(
          accountId,
          closeInput(closable.id),
        ),
      ).rejects.toBeInstanceOf(ToolEscapeCloseRefusedError);
      await expect(
        access.closeToolEscape(otherAccountId, closeInput(closable.id)),
      ).rejects.toMatchObject({ code: "TOOL_ESCAPE_NOT_FOUND" });
      expect(await db.select().from(toolEscapeClose)).toHaveLength(0);
    });

    test("the database holds one close per escape and a closed impact catalog", async () => {
      const db = requireDatabase();
      const access = createDatabaseProductGaps(db, proof);
      const { escape: closable } = await recordEscape(access);
      const row = {
        candidateBuild: build,
        escapeId: closable.id,
        externalCopyHow: "Archived.",
        gapId: closable.gapId,
        impact: "Lasting parallel source of truth",
        restoreMethod: "Manual recreate",
        workflowRef: "run-ok",
      };

      await db
        .insert(toolEscapeClose)
        .values({ ...row, id: crypto.randomUUID() });
      for (const bad of [{}, { impact: "Never held parallel truth" }]) {
        await expect(
          (async () => {
            await db
              .insert(toolEscapeClose)
              .values({ ...row, id: crypto.randomUUID(), ...bad });
          })(),
        ).rejects.toThrow();
      }
    });
  });
});
