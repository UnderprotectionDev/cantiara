import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseCustomFieldFinalizationWriter } from "../../custom-fields/server/custom-fields-mutation-database";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseProjectSourceRecords } from "../../project-source-records/server/project-source-records-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseRecordTable } from "./record-table-database";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const databaseTarget = databaseUrl ? new URL(databaseUrl) : undefined;
const databaseHost = databaseTarget?.hostname.replace(/^\[|\]$/g, "");
if (
  databaseTarget &&
  !(
    databaseHost &&
    ["localhost", "127.0.0.1", "::1"].includes(databaseHost) &&
    databaseTarget.pathname.slice(1).startsWith("cantiara_migration_test")
  )
) {
  throw new Error(
    "Record Table database tests require a loopback cantiara_migration_test database",
  );
}

const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Record Table public RPC database boundary", () => {
  const database = databaseUrl ? createDb({ DATABASE_URL: databaseUrl }) : null;
  const namespace = crypto.randomUUID().replaceAll("-", "");
  const accountId = `record-table-${namespace}`;
  const otherAccountId = `record-table-other-${namespace}`;
  const workspaceId = `workspace-${namespace}`;
  const otherWorkspaceId = `workspace-other-${namespace}`;
  const projectId = `project-${namespace}`;
  const otherProjectId = `project-other-${namespace}`;
  const firstDecisionId = `decision-first-${namespace}`;
  const secondDecisionId = `decision-second-${namespace}`;

  function client(principalAccountId = accountId) {
    if (!database) {
      throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    }
    const customFieldValueWriter =
      createDatabaseCustomFieldFinalizationWriter();
    const projectShell = createDatabaseProjectShell(database);
    const projectSourceRecords = createDatabaseProjectSourceRecords(database);
    const workLifecycle = createDatabaseWorkLifecycle(database, {
      customFieldValueWriter,
    });
    const context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: () => Promise.reject(new Error("Not part of this test.")),
      },
      auth: null,
      db: database,
      githubAvailability: { getStatus: () => "available" },
      recordTable: createDatabaseRecordTable({
        customFieldValueWriter,
        database,
        projectShell,
        projectSourceRecords,
        workLifecycle,
      }),
      session: {
        session: { id: "session-1" },
        user: { id: principalAccountId },
      } as Context["session"],
    } as unknown as Context;
    return createRouterClient(appRouter, { context });
  }

  async function createDecision(
    principalAccountId: string,
    scopedProjectId: string,
    id: string,
    title: string,
  ) {
    if (!database) {
      throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    }
    const record = await createDatabaseProjectSourceRecords(database).create(
      principalAccountId,
      {
        baseRevision: 0,
        clientIdempotencyKey: `record-table-seed-${crypto.randomUUID()}`,
        decision: `${title} selection`,
        id,
        projectId: scopedProjectId,
        rationale: null,
        sourceType: "Decision",
        title,
      },
    );
    if (!record) {
      throw new Error("Could not seed a Decision record.");
    }
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    }
    await database.insert(user).values([
      {
        email: `${accountId}@example.invalid`,
        id: accountId,
        name: "Table Founder",
      },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other Founder",
      },
    ]);
    await database.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await database.insert(project).values([
      {
        id: projectId,
        name: "Table Project",
        shortCode: `TBL-${namespace.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: otherProjectId,
        name: "Other Table Project",
        shortCode: `OTH-${namespace.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId: otherWorkspaceId,
      },
    ]);
    await createDecision(accountId, projectId, firstDecisionId, "First choice");
    await createDecision(
      accountId,
      projectId,
      secondDecisionId,
      "Second choice",
    );
    await createDecision(
      otherAccountId,
      otherProjectId,
      `decision-private-${namespace}`,
      "Private choice",
    );
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
    await database?.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("lists and writes canonical Work and Project records through the public RPC", async () => {
    const clientForAccount = client();
    const decisions = await clientForAccount.tableRecords({
      projectId,
      recordType: "Decision",
    });
    expect(decisions).toHaveLength(2);
    expect(decisions.map((record) => record.id)).toEqual(
      expect.arrayContaining([firstDecisionId, secondDecisionId]),
    );
    await expect(
      clientForAccount.tableRecords({
        projectId: otherProjectId,
        recordType: "Decision",
      }),
    ).resolves.toEqual([]);

    const workPaste = {
      clientIdempotencyKey: `record-table-work-${namespace}`,
      recordType: "Work" as const,
      rows: [
        {
          fields: { title: "Work created by Table" },
          kind: "create" as const,
          projectId,
        },
      ],
    };
    const created = await clientForAccount.applyTablePaste(workPaste);
    const replayed = await clientForAccount.applyTablePaste(workPaste);
    expect(replayed[0]?.id).toBe(created[0]?.id);
    expect(
      await clientForAccount.tableRecords({ projectId, recordType: "Work" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Work created by Table" }),
      ]),
    );

    const [createdWork] = created;
    if (!createdWork) {
      throw new Error("The Work record was not created.");
    }
    await clientForAccount.updateTableCell({
      baseRevision: createdWork.revision,
      clientIdempotencyKey: `record-table-work-cell-${namespace}`,
      field: "title",
      projectId,
      recordId: createdWork.id,
      recordType: "Work",
      value: "Work edited by Table",
    });
    await expect(
      clientForAccount.tableRecords({ projectId, recordType: "Work" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdWork.id,
          title: "Work edited by Table",
        }),
      ]),
    );

    const [first] = decisions;
    if (!first) {
      throw new Error("The first Decision was not listed.");
    }
    await clientForAccount.updateTableCell({
      baseRevision: first.revision,
      clientIdempotencyKey: `record-table-cell-${namespace}`,
      field: "title",
      projectId,
      recordId: firstDecisionId,
      recordType: "Decision",
      value: "First choice corrected",
    });
    await expect(
      clientForAccount.tableRecords({ projectId, recordType: "Decision" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstDecisionId,
          title: "First choice corrected",
        }),
      ]),
    );
  });

  test("rolls back every pasted owner write when a later row is stale", async () => {
    const clientForAccount = client();
    const decisions = await clientForAccount.tableRecords({
      projectId,
      recordType: "Decision",
    });
    const first = decisions.find((record) => record.id === firstDecisionId);
    if (!first) {
      throw new Error("The first Decision was not listed.");
    }

    await expect(
      clientForAccount.applyTablePaste({
        clientIdempotencyKey: `record-table-rollback-${namespace}`,
        recordType: "Decision",
        rows: [
          {
            baseRevision: first.revision,
            fields: { title: "Must roll back" },
            kind: "update",
            projectId,
            recordId: firstDecisionId,
          },
          {
            fields: {
              decision: "Must also roll back",
              title: "Created before stale row",
            },
            kind: "create",
            projectId,
            recordId: `decision-rollback-${namespace}`,
          },
          {
            baseRevision: 99,
            fields: { title: "Stale update" },
            kind: "update",
            projectId,
            recordId: secondDecisionId,
          },
        ],
      }),
    ).rejects.toBeDefined();

    const reread = await clientForAccount.tableRecords({
      projectId,
      recordType: "Decision",
    });
    expect(reread).toHaveLength(2);
    expect(reread).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstDecisionId, title: "First choice" }),
        expect.objectContaining({
          id: secondDecisionId,
          title: "Second choice",
        }),
      ]),
    );
  });
});
