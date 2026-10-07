import type { Context } from "@cantiara/api/context";
import type { ProjectSourceRecordsAccess } from "@cantiara/api/project-source-records";
import { transitionProjectSourceRecordInputSchema } from "@cantiara/api/project-source-records";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const accountId = "founder-account";
const decisionRecord = {
  createdAt: "2026-09-27T10:00:00.000Z",
  decision: "Ship a focused first release.",
  id: "decision-1",
  life: "Valid",
  projectId: "project-1",
  rationale: null,
  revision: 1,
  sourceType: "Decision",
  title: "First release scope",
  updatedAt: "2026-09-27T10:00:00.000Z",
} as const;

function testClient(session: Context["session"] | null) {
  const projectSourceRecords: ProjectSourceRecordsAccess = {
    create: vi.fn().mockResolvedValue(decisionRecord),
    find: vi.fn().mockResolvedValue(decisionRecord),
    list: vi.fn().mockResolvedValue([decisionRecord]),
    listDecisions: vi
      .fn()
      .mockResolvedValue({ records: [decisionRecord], readOnly: false }),
    transition: vi
      .fn()
      .mockResolvedValue({ ...decisionRecord, life: "Withdrawn" }),
    update: vi.fn().mockResolvedValue(decisionRecord),
  };
  const context = {
    auth: null,
    db: {} as Context["db"],
    projectSourceRecords,
    session,
  } as Context;
  return {
    client: createRouterClient(appRouter, { context }),
    projectSourceRecords,
  };
}

describe("Project source record RPC", () => {
  test("binds create, read, and transition calls to the authenticated Account", async () => {
    const { client, projectSourceRecords } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);

    await expect(
      client.createProjectSourceRecord({
        baseRevision: 0,
        clientIdempotencyKey: "decision-create",
        decision: "Ship a focused first release.",
        id: "decision-1",
        projectId: "project-1",
        rationale: null,
        sourceType: "Decision",
        title: "First release scope",
      }),
    ).resolves.toEqual(decisionRecord);
    await expect(
      client.projectSourceRecord({
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).resolves.toEqual(decisionRecord);
    await expect(
      client.transitionProjectSourceRecord({
        baseRevision: 1,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).resolves.toMatchObject({ life: "Withdrawn" });

    expect(projectSourceRecords.create).toHaveBeenCalledWith(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "decision-create",
      decision: "Ship a focused first release.",
      id: "decision-1",
      projectId: "project-1",
      rationale: null,
      sourceType: "Decision",
      title: "First release scope",
    });
    expect(projectSourceRecords.find).toHaveBeenCalledExactlyOnceWith(
      accountId,
      "Decision",
      "decision-1",
    );
    expect(projectSourceRecords.transition).toHaveBeenCalledExactlyOnceWith(
      accountId,
      {
        baseRevision: 1,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      },
    );
  });

  test("rejects anonymous source access and invalid terminal transitions", async () => {
    const anonymous = testClient(null);
    await expect(
      anonymous.client.projectSourceRecord({
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).rejects.toThrow();
    expect(anonymous.projectSourceRecords.find).not.toHaveBeenCalled();

    const authenticated = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        baseRevision: 1,
        clientIdempotencyKey: "decision-superseded",
        life: "Superseded",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      }).success,
    ).toBe(false);
    expect(
      authenticated.projectSourceRecords.transition,
    ).not.toHaveBeenCalled();
  });

  test("maps dropped Decision writes to client failures, never resolved successes", async () => {
    const { client, projectSourceRecords } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    vi.mocked(projectSourceRecords.create).mockResolvedValueOnce(null);
    vi.mocked(projectSourceRecords.update).mockResolvedValueOnce(null);
    vi.mocked(projectSourceRecords.transition).mockResolvedValueOnce(null);

    await expect(
      client.createProjectSourceRecord({
        baseRevision: 0,
        clientIdempotencyKey: "dropped-create",
        decision: "Ship a focused first release.",
        id: "decision-1",
        projectId: "project-1",
        rationale: null,
        sourceType: "Decision",
        title: "First release scope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.updateProjectSourceRecord({
        baseRevision: 1,
        clientIdempotencyKey: "dropped-update",
        decision: "Ship a focused first release.",
        projectId: "project-1",
        rationale: null,
        sourceId: "decision-1",
        sourceType: "Decision",
        title: "First release scope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.transitionProjectSourceRecord({
        baseRevision: 1,
        clientIdempotencyKey: "dropped-withdraw",
        life: "Withdrawn",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
