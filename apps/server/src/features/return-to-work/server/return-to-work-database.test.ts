// biome-ignore-all lint/style/noNonNullAssertion: Fixtures assert the presence of their source records at the seam.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
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
