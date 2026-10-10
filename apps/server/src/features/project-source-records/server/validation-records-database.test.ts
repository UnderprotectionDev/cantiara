import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabaseProjectSourceRecords } from "./project-source-records-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
(url ? describe : describe.skip)("Validation Records", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  beforeAll(async () => {
    if (!db) {
      throw new Error("Database required");
    }
    await db.insert(user).values({
      id: accountId,
      name: "Founder",
      email: `${accountId}@example.invalid`,
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Validation Records",
      shortCode: `V${accountId.slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
  });
  afterAll(async () => {
    await db?.delete(user).where(eq(user.id, accountId));
    await db?.$client.end();
  });
  test("saves a result and related context without writing counterpart life or creating a release gate", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const assumption = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Assumption",
      title: "Export demand",
      statement: "Founders need CSV",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    const question = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Open Question",
      title: "Which format?",
      question: "CSV or JSON?",
      context: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    const decision = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Decision",
      title: "Export scope",
      decision: "Evaluate CSV",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (!(assumption && question && decision)) {
      throw new Error("Context required");
    }
    const input = {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Validation Record" as const,
      title: "Export interviews",
      method: "Interview five founders",
      result: "Four need CSV",
      context: [
        { sourceType: "Assumption" as const, sourceId: assumption.id },
        { sourceType: "Open Question" as const, sourceId: question.id },
        { sourceType: "Decision" as const, sourceId: decision.id },
      ],
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    };
    const saved = await records.create(accountId, input);
    expect(saved).toMatchObject({
      sourceType: "Validation Record",
      method: "Interview five founders",
      result: "Four need CSV",
      context: input.context,
      status: "Active",
    });
    expect(await records.create(accountId, input)).toEqual(saved);
    expect(await records.find(accountId, "Assumption", assumption.id)).toEqual(
      assumption,
    );
    expect(await records.find(accountId, "Open Question", question.id)).toEqual(
      question,
    );
    expect(await records.find(accountId, "Decision", decision.id)).toEqual(
      decision,
    );
    const release = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Project Release",
      name: "Release despite uncertainty",
      description: null,
      versionLabel: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (!release) {
      throw new Error("Release required");
    }
    expect(
      await records.transition(accountId, {
        projectId,
        sourceId: release.id,
        sourceType: "Project Release",
        status: "Published",
        baseRevision: release.revision,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).toMatchObject({ status: "Published" });
  });
  test("rejects missing and cross-Project context atomically and protects revision and archive boundaries", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const create = {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Validation Record" as const,
      title: "Manual check",
      method: "Ask a founder",
      result: null,
      context: [],
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    };
    await expect(
      records.create(accountId, {
        ...create,
        context: [{ sourceType: "Assumption", sourceId: "missing-assumption" }],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await records.find(accountId, "Validation Record", create.id),
    ).toBeNull();
    const otherProjectId = crypto.randomUUID();
    await db.insert(project).values({
      id: otherProjectId,
      workspaceId,
      name: "Another Project",
      shortCode: `X${otherProjectId.slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
    const otherAssumption = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId: otherProjectId,
      sourceType: "Assumption",
      title: "Outside context",
      statement: "Not part of this Project",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (!otherAssumption) {
      throw new Error("Assumption required");
    }
    await expect(
      records.create(accountId, {
        ...create,
        clientIdempotencyKey: crypto.randomUUID(),
        context: [{ sourceType: "Assumption", sourceId: otherAssumption.id }],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await records.find(accountId, "Validation Record", create.id),
    ).toBeNull();
    const saved = await records.create(accountId, {
      ...create,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (saved?.sourceType !== "Validation Record") {
      throw new Error("Validation Record required");
    }
    expect(
      await records.find("another-account", "Validation Record", saved.id),
    ).toBeNull();
    expect(
      await records.listValidationRecords?.("another-account", projectId),
    ).toBeNull();
    const update = {
      projectId,
      sourceId: saved.id,
      sourceType: "Validation Record" as const,
      title: saved.title,
      method: saved.method,
      result: "Observed interest",
      context: saved.context,
      baseRevision: saved.revision,
      clientIdempotencyKey: crypto.randomUUID(),
    };
    const changed = await records.update(accountId, update);
    expect(changed).toMatchObject({ result: "Observed interest", revision: 2 });
    await expect(
      records.update(accountId, {
        ...update,
        result: "Stale overwrite",
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const archived = await records.transition(accountId, {
      projectId,
      sourceId: saved.id,
      sourceType: "Validation Record",
      status: "Archived",
      baseRevision: 2,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    expect(archived).toMatchObject({
      status: "Archived",
      result: "Observed interest",
    });
    await expect(
      records.update(accountId, {
        ...update,
        baseRevision: 3,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const trash = await records.transition(accountId, {
      projectId,
      sourceId: saved.id,
      sourceType: "Validation Record",
      status: "Trash",
      baseRevision: 3,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    expect(trash).toMatchObject({ status: "Trash" });
    const restored = await records.transition(accountId, {
      projectId,
      sourceId: saved.id,
      sourceType: "Validation Record",
      status: "Active",
      baseRevision: 4,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    expect(restored).toMatchObject({
      id: saved.id,
      status: "Active",
      result: "Observed interest",
    });
    await db
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(
      await records.listValidationRecords?.(accountId, projectId),
    ).toMatchObject({ readOnly: true });
    expect(
      await records.update(accountId, {
        ...update,
        baseRevision: 5,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).toBeNull();
    await db
      .update(project)
      .set({ archivedAt: null })
      .where(eq(project.id, projectId));
  });
});
