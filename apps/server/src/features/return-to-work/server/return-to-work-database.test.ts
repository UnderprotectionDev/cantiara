// biome-ignore-all lint/style/noNonNullAssertion: Fixtures assert the presence of their source records at the seam.
import { applyProjectShellConfigurationChange } from "@cantiara/api/project-shell";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
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
import { createDatabaseDailyFocus } from "../../daily-focus/server/daily-focus-database";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseProjectShellMutationContracts } from "../../project-shell/server/project-shell-mutation-database";
import {
  createDatabaseSmartCollections,
  sweepSmartCollectionSubscriptionSignals,
} from "../../smart-collections/server/smart-collections-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseReturnToWork } from "./return-to-work-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Return to Work PostgreSQL seam", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = `return-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const database = () => {
    if (!db) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return db;
  };
  beforeEach(async () => {
    await database()
      .insert(user)
      .values({
        id: accountId,
        name: "Founder",
        email: `${accountId}@example.invalid`,
      });
    await database()
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
  });
  afterEach(async () => {
    await database().delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await db?.$client.end();
  });
  async function fixture() {
    const fixtureDatabase = database();
    const projectShell = createDatabaseProjectShell(fixtureDatabase);
    const projectMutations =
      createDatabaseProjectShellMutationContracts(fixtureDatabase);
    const workLifecycle = createDatabaseWorkLifecycle(fixtureDatabase);
    const currentProject = await projectShell.create(accountId, {
      name: "Return test",
      shortCode: "RETURN",
      starterConfiguration: "Blank Project",
    });
    const currentWork = await workLifecycle.create(accountId, {
      projectId: currentProject.id,
      type: "Task",
      title: "Follow up with customer",
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    const access = createDatabaseReturnToWork(fixtureDatabase, {
      projectMutations,
      workLifecycle,
    });
    return {
      access,
      currentProject,
      currentWork,
      projectShell,
      projectMutations,
      workLifecycle,
    };
  }
  test("derives the optional long-status reason and prepared collection without changing Work or emitting signals", async () => {
    const {
      access,
      currentProject,
      currentWork,
      projectShell,
      workLifecycle,
      projectMutations,
    } = await fixture();
    const collections = createDatabaseSmartCollections(database());
    const context = { projectId: currentProject.id, workId: currentWork.id };
    await database()
      .update(work)
      .set({ statusChangedAt: new Date("2025-01-01T00:00:00.000Z") })
      .where(eq(work.id, currentWork.id));
    expect(
      (await access.read(accountId, context)).cards[0]?.reasons,
    ).not.toContain("Long in the same status");
    expect(await collections.listViews(accountId, currentProject.id)).toEqual(
      [],
    );
    const before = await workLifecycle.find(accountId, currentWork.id);
    const mutation = projectMutations.update(accountId);
    await mutation.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: (await projectShell.find(accountId, currentProject.id))!
          .revision,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        targetId: currentProject.id,
        payload: { thresholdDays: 7 },
      },
      ({ currentValue, currentRevision, committedAt }) => ({
        project: {
          ...currentValue.project!,
          revision: currentRevision + 1,
          updatedAt: committedAt,
          configuration: applyProjectShellConfigurationChange(
            currentValue.project!.configuration,
            { kind: "set-status-age-threshold", thresholdDays: 7 },
            "Blank Project",
          ),
        },
      }),
    );
    expect(
      (await projectShell.find(accountId, currentProject.id))?.configuration
        .statusAgeThresholdDays,
    ).toBe(7);
    expect((await access.read(accountId, context)).cards[0]?.reasons).toContain(
      "Long in the same status",
    );
    const [prepared] = await collections.listViews(
      accountId,
      currentProject.id,
    );
    expect(prepared).toMatchObject({
      collectionName: "Long in the same status",
      isSubscribed: false,
      notifyOnLeave: false,
      works: [
        expect.objectContaining({
          id: currentWork.id,
          membershipReasons: expect.arrayContaining([
            "Long in the same status",
          ]),
        }),
      ],
    });
    expect(await collections.getView(accountId, prepared!.id)).toEqual(
      prepared,
    );
    expect(await collections.getView("other-account", prepared!.id)).toBeNull();
    expect(await workLifecycle.find(accountId, currentWork.id)).toEqual(before);
    expect(await sweepSmartCollectionSubscriptionSignals(database())).toBe(0);
  });
  test("re-evaluates prepared membership and excludes closed, archived, trashed and foreign Work", async () => {
    const { access, currentProject, currentWork } = await fixture();
    const collections = createDatabaseSmartCollections(database());
    await database()
      .update(project)
      .set({
        configuration: {
          ...currentProject.configuration,
          statusAgeThresholdDays: 7,
        },
      })
      .where(eq(project.id, currentProject.id));
    await database()
      .update(work)
      .set({ statusChangedAt: new Date("2025-01-01T00:00:00.000Z") })
      .where(eq(work.id, currentWork.id));
    const inactive = [
      { id: "closed", status: "Closed", closureResult: "Completed" },
      { id: "archived", archivedAt: new Date() },
      { id: "trashed", trashedAt: new Date() },
      { id: "future", statusChangedAt: new Date("2099-01-01T00:00:00.000Z") },
    ];
    await database()
      .insert(work)
      .values(
        inactive.map((record, index) => ({
          number: index + 2,
          key: `RETURN-${index + 2}`,
          title: record.id,
          type: "Task",
          projectId: currentProject.id,
          statusChangedAt: new Date("2025-01-01T00:00:00.000Z"),
          ...record,
        })),
      );
    const [prepared] = await collections.listViews(
      accountId,
      currentProject.id,
    );
    expect(prepared!.works.map((record) => record.id)).toEqual([
      currentWork.id,
    ]);
    expect(
      (await access.read(accountId, { projectId: currentProject.id })).cards
        .filter((card) => card.reasons.includes("Long in the same status"))
        .map((card) => card.id),
    ).toEqual([currentWork.id]);
    expect(
      (
        await access.read(accountId, {
          projectId: currentProject.id,
          workId: "archived",
        })
      ).cards.flatMap((card) => card.reasons),
    ).not.toContain("Long in the same status");
    await database()
      .update(work)
      .set({ statusChangedAt: new Date() })
      .where(eq(work.id, currentWork.id));
    expect((await collections.getView(accountId, prepared!.id))!.works).toEqual(
      [],
    );
    await database()
      .update(project)
      .set({
        configuration: {
          ...currentProject.configuration,
          statusAgeThresholdDays: null,
        },
      })
      .where(eq(project.id, currentProject.id));
    expect(await collections.listViews(accountId, currentProject.id)).toEqual(
      [],
    );
    expect(await collections.getView(accountId, prepared!.id)).toBeNull();
    await database()
      .update(project)
      .set({
        configuration: {
          ...currentProject.configuration,
          statusAgeThresholdDays: 7,
        },
        archivedAt: new Date(),
      })
      .where(eq(project.id, currentProject.id));
    expect(await collections.listViews(accountId, currentProject.id)).toEqual(
      [],
    );
    expect(
      (
        await access.read(accountId, { projectId: currentProject.id })
      ).cards.flatMap((card) => card.reasons),
    ).not.toContain("Long in the same status");
  });

  test("reads all six defined groups from current sources and excludes unrelated Work context", async () => {
    const { access, currentProject, currentWork } = await fixture();
    const context = { projectId: currentProject.id };
    await access.markViewed(accountId, context);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const time = new Date();
    await database().insert(decision).values({
      id: currentWork.id,
      projectId: currentProject.id,
      title: "Release scope",
      decision: "Ship",
      createdAt: time,
    });
    await database().insert(risk).values({
      id: "risk",
      projectId: currentProject.id,
      title: "Payments",
      createdAt: time,
    });
    await database().insert(document).values({
      id: "document",
      projectId: currentProject.id,
      title: "Release notes",
      body: "Notes",
      createdAt: time,
    });
    await database().insert(projectRelease).values({
      id: "release",
      projectId: currentProject.id,
      name: "First release",
    });
    await database()
      .insert(mutationHistory)
      .values([
        {
          id: crypto.randomUUID(),
          targetId: currentWork.id,
          revision: 4,
          actorType: "User",
          actorId: accountId,
          originKind: "human",
          payloadFingerprint: "unsupported",
          previousValue: {},
          nextValue: { analytics: { seen: true } },
          occurredAt: time,
        },
        {
          id: crypto.randomUUID(),
          targetId: currentWork.id,
          revision: 2,
          actorType: "User",
          actorId: accountId,
          originKind: "human",
          payloadFingerprint: "work",
          previousValue: {},
          nextValue: { work: { title: "Updated" } },
          occurredAt: time,
        },
        {
          id: crypto.randomUUID(),
          targetId: currentWork.id,
          revision: 3,
          actorType: "GitHub",
          actorId: "github",
          originKind: "source",
          sourceId: "delivery-source",
          deliveryId: "delivery",
          payloadFingerprint: "github",
          previousValue: {},
          nextValue: { work: { status: "In Progress" } },
          occurredAt: time,
        },
        {
          id: crypto.randomUUID(),
          targetId: "release",
          revision: 2,
          actorType: "User",
          actorId: accountId,
          originKind: "human",
          payloadFingerprint: "publish",
          previousValue: { projectRelease: { status: "Draft" } },
          nextValue: { projectRelease: { status: "Published" } },
          occurredAt: time,
        },
      ]);
    const summary = await access.read(accountId, context);
    expect(
      summary.sinceLastLooked.groups.map((group) => [
        group.name,
        group.events.map((event) => event.kind),
      ]),
    ).toEqual([
      ["Work", ["Work updated"]],
      ["Decisions", ["Decision recorded"]],
      ["Risks", ["Risk recorded"]],
      ["Documents", ["Document created"]],
      ["GitHub", ["GitHub development signal"]],
      ["Publish", ["Project Release published"]],
    ]);
    expect(
      summary.sinceLastLooked.groups
        .flatMap((group) => group.events)
        .every(
          (event) =>
            Object.keys(event.source).sort().join(",") ===
            "id,projectId,sourcePath,title",
        ),
    ).toBe(true);
    expect(
      (await access.read(accountId, { ...context, workId: currentWork.id }))
        .sinceLastLooked.groups,
    ).toEqual([]);
    await expect(access.read("visitor", context)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  test("deleting Work or Project removes its visit so a reused fixture identity starts without a mark", async () => {
    const { access, currentProject, currentWork } = await fixture();
    const context = { projectId: currentProject.id, workId: currentWork.id };
    await access.markViewed(accountId, context);
    const [oldWork] = await database()
      .select()
      .from(work)
      .where(eq(work.id, currentWork.id));
    await database().delete(work).where(eq(work.id, currentWork.id));
    await database().insert(work).values(oldWork!);
    expect(
      (await access.read(accountId, context)).sinceLastLooked.lastViewedAt,
    ).toBeNull();
    await access.markViewed(accountId, { projectId: currentProject.id });
    const [oldProject] = await database()
      .select()
      .from(project)
      .where(eq(project.id, currentProject.id));
    await database().delete(project).where(eq(project.id, currentProject.id));
    await database().insert(project).values(oldProject!);
    expect(
      (await access.read(accountId, { projectId: currentProject.id }))
        .sinceLastLooked.lastViewedAt,
    ).toBeNull();
  });
  test("keeps first visits empty and reads later Work changes without moving the visit or creating history", async () => {
    const { access, currentProject, currentWork } = await fixture();
    const context = { projectId: currentProject.id, workId: currentWork.id };
    expect((await access.read(accountId, context)).sinceLastLooked).toEqual({
      lastViewedAt: null,
      groups: [],
    });
    await access.markViewed(accountId, context);
    const visited = (await access.read(accountId, context)).sinceLastLooked;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await access.saveNextStep(accountId, {
      ...context,
      baseRevision: currentWork.revision,
      clientIdempotencyKey: "changed-after-visit",
      nextConcreteStep: "Review payments",
    });
    const summary = await access.read(accountId, context);
    expect(summary.sinceLastLooked.lastViewedAt).toBe(visited.lastViewedAt);
    expect(summary.sinceLastLooked.groups).toEqual([
      {
        name: "Work",
        events: [
          expect.objectContaining({
            kind: "Work updated",
            source: expect.objectContaining({
              id: currentWork.id,
              title: "RETURN-1 · Follow up with customer",
            }),
          }),
        ],
      },
    ]);
    expect((await access.read(accountId, context)).sinceLastLooked).toEqual(
      summary.sinceLastLooked,
    );
    expect(
      (await access.read(accountId, { projectId: currentProject.id }))
        .sinceLastLooked.groups,
    ).toEqual([]);
    await access.markViewed(accountId, context);
    expect(
      (await access.read(accountId, context)).sinceLastLooked.groups,
    ).toEqual([]);
  });
  test("source hint survives status, date, effort, planning and Project configuration changes", async () => {
    const {
      access,
      currentProject,
      currentWork,
      projectShell,
      projectMutations,
      workLifecycle,
    } = await fixture();
    const context = { projectId: currentProject.id, workId: currentWork.id };
    await access.saveNextStep(accountId, {
      ...context,
      nextConcreteStep: "Ask for payment logs",
      baseRevision: currentWork.revision,
      clientIdempotencyKey: "step",
    });
    let source = (await access.read(accountId, context)).source!;
    const hintTime = source.nextConcreteStepUpdatedAt;
    await workLifecycle.updateFields(accountId, {
      workId: currentWork.id,
      fields: {
        status: "In Progress",
        targetDate: "2026-12-01",
        effort: "Large",
      },
      baseRevision: source.revision,
      clientIdempotencyKey: "fields",
    });
    source = (await access.read(accountId, context)).source!;
    await workLifecycle.updateRoadmapHorizon(accountId, {
      workId: currentWork.id,
      horizon: "Next",
      baseRevision: source.revision,
      clientIdempotencyKey: "horizon",
    });
    await createDatabaseDailyFocus(database()).add(
      accountId,
      "2026-10-07",
      currentWork.id,
    );
    expect((await access.read(accountId, context)).source).toMatchObject({
      nextConcreteStep: "Ask for payment logs",
      nextConcreteStepUpdatedAt: hintTime,
    });
    const projectContext = { projectId: currentProject.id };
    await access.saveNextStep(accountId, {
      ...projectContext,
      nextConcreteStep: "Write acceptance examples",
      baseRevision: (await projectShell.find(accountId, currentProject.id))!
        .revision,
      clientIdempotencyKey: "project-step",
    });
    const profile = (await projectShell.find(accountId, currentProject.id))!;
    await projectMutations.update(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: profile.revision,
        clientIdempotencyKey: "stage",
        kind: "human",
        payload: { change: "stage" },
        targetId: profile.id,
      },
      ({ currentValue }) => ({
        project: {
          ...currentValue.project!,
          configuration: {
            ...currentValue.project!.configuration,
            preparedStages: [],
          },
        },
      }),
    );
    expect(
      (await access.read(accountId, projectContext)).source!.nextConcreteStep,
    ).toBe("Write acceptance examples");
  });
  test("uses current sources and denies another account and mismatched Work context", async () => {
    const { access, currentProject, currentWork } = await fixture();
    const context = { projectId: currentProject.id };
    await database().insert(risk).values({
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      title: "Payment risk",
    });
    expect(
      (await access.read(accountId, context)).cards.find(
        (card) => card.recordType === "Risk",
      ),
    ).toMatchObject({
      title: "Payment risk",
      reasons: expect.arrayContaining(["Open risk"]),
    });
    const before = (
      await access.read(accountId, { ...context, workId: currentWork.id })
    ).source!;
    await access.markViewed(accountId, { ...context, workId: currentWork.id });
    const viewed = await access.read(accountId, {
      ...context,
      workId: currentWork.id,
    });
    expect(viewed.cards[0]!.reasons).toContain("Recently viewed");
    expect(viewed.source!.revision).toBe(before.revision);
    await expect(access.read("other-account", context)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      access.saveNextStep("other-account", {
        ...context,
        nextConcreteStep: "Forbidden",
        baseRevision: 0,
        clientIdempotencyKey: "forbidden",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      access.markViewed(accountId, { ...context, workId: "other-work" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await database()
      .update(work)
      .set({ title: "Renamed source" })
      .where(eq(work.id, currentWork.id));
    expect(
      (await access.read(accountId, { ...context, workId: currentWork.id }))
        .source!.title,
    ).toContain("Renamed source");
    await database().delete(work).where(eq(work.id, currentWork.id));
    expect(
      (await access.read(accountId, context)).cards.some(
        (card) => card.id === currentWork.id,
      ),
    ).toBe(false);
    await database().delete(project).where(eq(project.id, currentProject.id));
    await expect(access.read(accountId, context)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  test("keeps archived contexts readable, still marks visits, and rejects archived Project writes", async () => {
    const { access, currentProject, currentWork, workLifecycle } =
      await fixture();
    const workContext = {
      projectId: currentProject.id,
      workId: currentWork.id,
    };
    await workLifecycle.archive(accountId, {
      baseRevision: currentWork.revision,
      clientIdempotencyKey: "archive-work",
      workId: currentWork.id,
    });
    const archivedWork = await access.read(accountId, workContext);
    expect(archivedWork.readOnly).toBe(false);
    expect(archivedWork.source).toMatchObject({ id: currentWork.id });
    await access.saveNextStep(accountId, {
      ...workContext,
      baseRevision: archivedWork.source!.revision,
      clientIdempotencyKey: "archived-work-step",
      nextConcreteStep: "Resume from archived context",
    });
    expect(
      (await access.read(accountId, workContext)).source!.nextConcreteStep,
    ).toBe("Resume from archived context");
    await access.markViewed(accountId, workContext);
    await database()
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, currentProject.id));
    const projectContext = { projectId: currentProject.id };
    const archivedProject = await access.read(accountId, projectContext);
    expect(archivedProject.readOnly).toBe(true);
    expect(archivedProject.source).toMatchObject({ id: currentProject.id });
    await access.markViewed(accountId, projectContext);
    await expect(
      access.saveNextStep(accountId, {
        ...projectContext,
        baseRevision: archivedProject.source!.revision,
        clientIdempotencyKey: "archived-project-step",
        nextConcreteStep: "Blocked write",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  test("uses only the explicit GitHub signal adapter for authorized current Work", async () => {
    const {
      access,
      currentProject,
      currentWork,
      projectMutations,
      workLifecycle,
    } = await fixture();
    const context = { projectId: currentProject.id };
    expect(
      (await access.read(accountId, context)).cards.flatMap(
        (card) => card.reasons,
      ),
    ).not.toContain("Pending GitHub development signal");
    const integrated = createDatabaseReturnToWork(database(), {
      projectMutations,
      workLifecycle,
      pendingGitHubSignals: {
        workIds: (owner, sourceContext) => {
          expect(owner).toBe(accountId);
          expect(sourceContext).toEqual(context);
          return Promise.resolve(new Set([currentWork.id, "unavailable-work"]));
        },
      },
    });
    const summary = await integrated.read(accountId, context);
    expect(
      summary.cards.find((card) => card.id === currentWork.id)?.reasons,
    ).toContain("Pending GitHub development signal");
    expect(summary.cards.some((card) => card.id === "unavailable-work")).toBe(
      false,
    );
    await expect(
      integrated.read("other-account", context),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  test("replaces and clears the hint, rejects stale writes, and replays retries", async () => {
    const { access, currentProject, currentWork } = await fixture();
    const context = { projectId: currentProject.id, workId: currentWork.id };
    const input = {
      ...context,
      baseRevision: currentWork.revision,
      clientIdempotencyKey: "first",
      nextConcreteStep: "First step",
    };
    await access.saveNextStep(accountId, input);
    const first = (await access.read(accountId, context)).source!;
    await access.saveNextStep(accountId, input);
    expect((await access.read(accountId, context)).source!.revision).toBe(
      first.revision,
    );
    await expect(
      access.saveNextStep(accountId, {
        ...input,
        clientIdempotencyKey: "stale",
        nextConcreteStep: "Stale overwrite",
      }),
    ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
    await access.saveNextStep(accountId, {
      ...input,
      baseRevision: first.revision,
      clientIdempotencyKey: "second",
      nextConcreteStep: "Replacement",
    });
    const second = (await access.read(accountId, context)).source!;
    expect(second.nextConcreteStep).toBe("Replacement");
    await access.saveNextStep(accountId, {
      ...input,
      baseRevision: second.revision,
      clientIdempotencyKey: "clear",
      nextConcreteStep: "  ",
    });
    expect(
      (await access.read(accountId, context)).source!.nextConcreteStep,
    ).toBeNull();
  });
});
