import type { Context } from "@cantiara/api/context";
import {
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "@cantiara/api/project-source-records";
import type {
  RecordTableCellUpdateInput,
  RecordTablePasteInput,
} from "@cantiara/api/record-discovery";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";
import { createRecordTableAccess } from "./record-table";

function createContext() {
  const list = vi.fn().mockResolvedValue([
    {
      id: "work-1",
      key: "CAT-1",
      projectId: "project-1",
      title: "Prepare launch",
      type: "Task",
    },
  ]);
  const updateCell = vi.fn().mockResolvedValue({
    id: "decision-1",
    projectId: "project-1",
    revision: 3,
    sourceType: "Decision",
    title: "Choose a launch date",
    decision: "Ship in June",
    rationale: null,
    life: "Valid",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  });
  const applyPaste = vi.fn().mockResolvedValue([
    {
      id: "decision-1",
      projectId: "project-1",
      revision: 3,
      sourceType: "Decision",
      title: "Choose a launch date",
      decision: "Ship in June",
      rationale: null,
      life: "Valid",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);
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
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    recordTable: { applyPaste, list, updateCell },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    },
  } as unknown as Context;

  return { applyPaste, context, list, updateCell };
}

describe("type-scoped Table RPC", () => {
  test("lists canonical owner records through the authenticated Account", async () => {
    const { context, list } = createContext();
    const client = createRouterClient(appRouter, { context });

    const records = await client.tableRecords({
      projectId: "project-1",
      recordType: "Work",
    });

    expect(records).toEqual([
      {
        id: "work-1",
        key: "CAT-1",
        projectId: "project-1",
        title: "Prepare launch",
        type: "Task",
      },
    ]);
    expect(list).toHaveBeenCalledWith("account-1", {
      projectId: "project-1",
      recordType: "Work",
    });
  });

  test("rejects unauthenticated listing before reading canonical owners", async () => {
    const { context, list } = createContext();
    context.session = null;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.tableRecords({ projectId: "project-1", recordType: "Work" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(list).not.toHaveBeenCalled();
  });

  test("writes an allowed cell through the authenticated Record Table seam", async () => {
    const { context, updateCell } = createContext();
    const client = createRouterClient(appRouter, { context });
    const input: RecordTableCellUpdateInput = {
      baseRevision: 2,
      clientIdempotencyKey: "table-cell-edit-1",
      field: "title",
      projectId: "project-1",
      recordId: "decision-1",
      recordType: "Decision",
      value: "Choose a launch date",
    };

    await expect(client.updateTableCell(input)).resolves.toMatchObject({
      id: "decision-1",
      title: "Choose a launch date",
    });
    expect(updateCell).toHaveBeenCalledWith("account-1", input);
  });

  test("rejects unauthenticated cell writes before reaching a canonical owner", async () => {
    const { context, updateCell } = createContext();
    context.session = null;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 2,
        clientIdempotencyKey: "table-cell-edit-2",
        field: "title",
        projectId: "project-1",
        recordId: "decision-1",
        recordType: "Decision",
        value: "Choose a date",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updateCell).not.toHaveBeenCalled();
  });

  test("applies the user's final paste selection through one authenticated seam", async () => {
    const { applyPaste, context } = createContext();
    const client = createRouterClient(appRouter, { context });
    const input: RecordTablePasteInput = {
      clientIdempotencyKey: "table-paste-1",
      recordType: "Decision",
      rows: [
        {
          baseRevision: 2,
          fields: { title: "Choose a launch date" },
          kind: "update",
          projectId: "project-1",
          recordId: "decision-1",
        },
      ],
    };

    await expect(client.applyTablePaste(input)).resolves.toHaveLength(1);
    expect(applyPaste).toHaveBeenCalledWith("account-1", input);
  });

  test("rejects unauthenticated paste before reaching a canonical owner", async () => {
    const { applyPaste, context } = createContext();
    context.session = null;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.applyTablePaste({
        clientIdempotencyKey: "table-paste-2",
        recordType: "Decision",
        rows: [],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(applyPaste).not.toHaveBeenCalled();
  });

  test("rejects types outside the implemented canonical owner set at the RPC boundary", async () => {
    const { applyPaste, context, updateCell } = createContext();
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 2,
        clientIdempotencyKey: "table-cell-edit-3",
        field: "title",
        projectId: "project-1",
        recordId: "document-1",
        recordType: "Document",
        value: "Cannot edit a Document in Table",
      } as never),
    ).rejects.toBeDefined();
    expect(updateCell).not.toHaveBeenCalled();
    expect(applyPaste).not.toHaveBeenCalled();
  });

  test("rejects Decision lifecycle values outside the canonical Table transition contract", async () => {
    const { context, updateCell } = createContext();
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 2,
        clientIdempotencyKey: "decision-life-cell-1",
        field: "life",
        projectId: "project-1",
        recordId: "decision-1",
        recordType: "Decision",
        value: "Superseded",
      }),
    ).rejects.toBeDefined();
    expect(updateCell).not.toHaveBeenCalled();
  });

  test("updates one Decision field through its canonical owner", async () => {
    const currentRecord = {
      createdAt: "2026-01-01T00:00:00.000Z",
      decision: "Ship in June",
      id: "decision-1",
      life: "Valid",
      projectId: "project-1",
      rationale: null,
      revision: 2,
      sourceType: "Decision",
      title: "Choose a launch date",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const update = vi.fn().mockResolvedValue({
      ...currentRecord,
      revision: 3,
      title: "Choose the launch date",
    });
    const projectSourceRecords = {
      find: vi.fn().mockResolvedValue(currentRecord),
      list: vi.fn(),
      transition: vi.fn(),
      update,
    };
    const workLifecycle = { list: vi.fn(), updateFields: vi.fn() };
    const projectShell = { find: vi.fn(), list: vi.fn() };
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: projectShell as never,
        projectSourceRecords: projectSourceRecords as never,
        workLifecycle: workLifecycle as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 2,
        clientIdempotencyKey: "decision-title-cell-1",
        field: "title",
        projectId: "project-1",
        recordId: "decision-1",
        recordType: "Decision",
        value: "Choose the launch date",
      }),
    ).resolves.toMatchObject({
      id: "decision-1",
      revision: 3,
      title: "Choose the launch date",
    });
    expect(projectSourceRecords.find).toHaveBeenCalledWith(
      "account-1",
      "Decision",
      "decision-1",
    );
    expect(update).toHaveBeenCalledWith("account-1", {
      baseRevision: 2,
      clientIdempotencyKey: "decision-title-cell-1",
      decision: "Ship in June",
      projectId: "project-1",
      rationale: null,
      sourceId: "decision-1",
      sourceType: "Decision",
      title: "Choose the launch date",
    });
  });

  test("transitions Decision life through its canonical owner contract", async () => {
    const currentRecord = {
      createdAt: "2026-01-01T00:00:00.000Z",
      decision: "Ship in June",
      id: "decision-1",
      life: "Valid",
      projectId: "project-1",
      rationale: null,
      revision: 2,
      sourceType: "Decision",
      title: "Choose a launch date",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as const;
    const transition = vi.fn((_accountId, rawInput) => {
      const input = transitionProjectSourceRecordInputSchema.parse(rawInput);
      if (input.sourceType !== "Decision") {
        throw new Error("Expected a Decision transition.");
      }
      return { ...currentRecord, life: input.life, revision: 3 };
    });
    const update = vi.fn();
    const projectSourceRecords = {
      find: vi.fn().mockResolvedValue(currentRecord),
      list: vi.fn(),
      transition,
      update,
    };
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: { find: vi.fn(), list: vi.fn() } as never,
        projectSourceRecords: projectSourceRecords as never,
        workLifecycle: { list: vi.fn(), updateFields: vi.fn() } as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 2,
        clientIdempotencyKey: "decision-life-cell-1",
        field: "life",
        projectId: "project-1",
        recordId: "decision-1",
        recordType: "Decision",
        value: "Withdrawn",
      }),
    ).resolves.toMatchObject({ life: "Withdrawn", revision: 3 });
    expect(transition).toHaveBeenCalledWith("account-1", {
      baseRevision: 2,
      clientIdempotencyKey: "decision-life-cell-1",
      life: "Withdrawn",
      projectId: "project-1",
      sourceId: "decision-1",
      sourceType: "Decision",
    });
    expect(update).not.toHaveBeenCalled();
  });

  test("updates one Risk field through its canonical owner contract", async () => {
    const currentRecord = {
      createdAt: "2026-01-01T00:00:00.000Z",
      description: null,
      id: "risk-1",
      impact: "Moderate",
      life: "Open",
      probability: "Likely",
      projectId: "project-1",
      rationale: null,
      response: null,
      revision: 4,
      sourceType: "Risk",
      title: "Launch dependency",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as const;
    const update = vi.fn((_accountId, rawInput) => {
      const input = updateProjectSourceRecordInputSchema.parse(rawInput);
      if (input.sourceType !== "Risk") {
        throw new Error("Expected a Risk update.");
      }
      return {
        ...currentRecord,
        impact: input.impact,
        revision: 5,
      };
    });
    const projectSourceRecords = {
      find: vi.fn().mockResolvedValue(currentRecord),
      list: vi.fn(),
      transition: vi.fn(),
      update,
    };
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: { find: vi.fn(), list: vi.fn() } as never,
        projectSourceRecords: projectSourceRecords as never,
        workLifecycle: { list: vi.fn(), updateFields: vi.fn() } as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 4,
        clientIdempotencyKey: "risk-impact-cell-1",
        field: "impact",
        projectId: "project-1",
        recordId: "risk-1",
        recordType: "Risk",
        value: "High",
      }),
    ).resolves.toMatchObject({ impact: "High", revision: 5 });
    expect(update).toHaveBeenCalledWith("account-1", {
      baseRevision: 4,
      clientIdempotencyKey: "risk-impact-cell-1",
      description: null,
      impact: "High",
      probability: "Likely",
      projectId: "project-1",
      rationale: null,
      response: null,
      sourceId: "risk-1",
      sourceType: "Risk",
      title: "Launch dependency",
    });
  });

  test("applies a multi-field paste through one Record Table transaction", async () => {
    const currentRecord = {
      createdAt: "2026-01-01T00:00:00.000Z",
      decision: "Ship in June",
      id: "decision-1",
      life: "Valid",
      projectId: "project-1",
      rationale: null,
      revision: 2,
      sourceType: "Decision",
      title: "Choose a launch date",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as const;
    const update = vi.fn((_accountId, rawInput) => {
      const input = updateProjectSourceRecordInputSchema.parse(rawInput);
      if (input.sourceType !== "Decision") {
        throw new Error("Expected a Decision update.");
      }
      return { ...currentRecord, revision: 3, title: input.title };
    });
    const transition = vi.fn((_accountId, rawInput) => {
      const input = transitionProjectSourceRecordInputSchema.parse(rawInput);
      if (input.sourceType !== "Decision") {
        throw new Error("Expected a Decision transition.");
      }
      return {
        ...currentRecord,
        life: input.life,
        revision: 4,
        title: "Updated",
      };
    });
    const projectSourceRecords = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue(currentRecord),
      list: vi.fn(),
      transition,
      update,
    };
    const workLifecycle = {
      create: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
      updateFields: vi.fn(),
      updateStatus: vi.fn(),
    };
    const withWriteTransaction = vi.fn(async (run) =>
      run({ projectSourceRecords, workLifecycle }),
    );
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: { find: vi.fn(), list: vi.fn() } as never,
        projectSourceRecords: projectSourceRecords as never,
        withWriteTransaction,
        workLifecycle: workLifecycle as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.applyTablePaste({
        clientIdempotencyKey: "decision-paste-1",
        recordType: "Decision",
        rows: [
          {
            baseRevision: 2,
            fields: { life: "Withdrawn", title: "Updated" },
            kind: "update",
            projectId: "project-1",
            recordId: "decision-1",
          },
        ],
      }),
    ).resolves.toMatchObject([
      { id: "decision-1", life: "Withdrawn", revision: 4 },
    ]);
    expect(withWriteTransaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("account-1", {
      baseRevision: 2,
      clientIdempotencyKey: "decision-paste-1:row:0:content",
      decision: "Ship in June",
      projectId: "project-1",
      rationale: null,
      sourceId: "decision-1",
      sourceType: "Decision",
      title: "Updated",
    });
    expect(transition).toHaveBeenCalledWith("account-1", {
      baseRevision: 3,
      clientIdempotencyKey: "decision-paste-1:row:0:status",
      life: "Withdrawn",
      projectId: "project-1",
      sourceId: "decision-1",
      sourceType: "Decision",
    });
  });

  test("does not transition a Decision when pasted Life is unchanged", async () => {
    const currentRecord = {
      createdAt: "2026-01-01T00:00:00.000Z",
      decision: "Ship in June",
      id: "decision-1",
      life: "Valid",
      projectId: "project-1",
      rationale: null,
      revision: 2,
      sourceType: "Decision",
      title: "Choose a launch date",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as const;
    const transition = vi
      .fn()
      .mockRejectedValue(
        new Error("Unchanged Decision life is not a transition."),
      );
    const projectSourceRecords = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue(currentRecord),
      list: vi.fn(),
      transition,
      update: vi.fn(),
    };
    const workLifecycle = {
      create: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
      updateFields: vi.fn(),
      updateStatus: vi.fn(),
    };
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: { find: vi.fn(), list: vi.fn() } as never,
        projectSourceRecords: projectSourceRecords as never,
        withWriteTransaction: vi.fn(async (run) =>
          run({ projectSourceRecords, workLifecycle }),
        ),
        workLifecycle: workLifecycle as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.applyTablePaste({
        clientIdempotencyKey: "decision-paste-same-life-1",
        recordType: "Decision",
        rows: [
          {
            baseRevision: 2,
            fields: { life: "Valid" },
            kind: "update",
            projectId: "project-1",
            recordId: "decision-1",
          },
        ],
      }),
    ).resolves.toEqual([currentRecord]);
    expect(transition).not.toHaveBeenCalled();
  });

  test("pasting a new Open Question preserves its mapped answer through the canonical owner", async () => {
    const createdRecord = {
      answer: null,
      context: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "question-1",
      life: "Open",
      projectId: "project-1",
      question: "Which date should we choose?",
      revision: 1,
      sourceType: "Open Question",
      title: "Choose a launch date",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as const;
    const create = vi.fn().mockResolvedValue(createdRecord);
    const update = vi.fn((_accountId, rawInput) => {
      const input = updateProjectSourceRecordInputSchema.parse(rawInput);
      if (input.sourceType !== "Open Question") {
        throw new Error("Expected an Open Question update.");
      }
      return {
        ...createdRecord,
        answer: input.answer,
        context: input.context,
        question: input.question,
        revision: 2,
        title: input.title,
      };
    });
    const projectSourceRecords = {
      create,
      find: vi.fn(),
      list: vi.fn(),
      transition: vi.fn(),
      update,
    };
    const workLifecycle = {
      create: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
      updateFields: vi.fn(),
      updateStatus: vi.fn(),
    };
    const withWriteTransaction = vi.fn(async (run) =>
      run({ projectSourceRecords, workLifecycle }),
    );
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: { find: vi.fn(), list: vi.fn() } as never,
        projectSourceRecords: projectSourceRecords as never,
        withWriteTransaction,
        workLifecycle: workLifecycle as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });
    const input: RecordTablePasteInput = {
      clientIdempotencyKey: "open-question-paste-1",
      recordType: "Open Question",
      rows: [
        {
          fields: {
            answer: "Ship in June",
            question: "Which date should we choose?",
            title: "Choose a launch date",
          },
          kind: "create",
          projectId: "project-1",
          recordId: "question-1",
        },
      ],
    };

    await expect(client.applyTablePaste(input)).resolves.toMatchObject([
      { answer: "Ship in June", id: "question-1", revision: 2 },
    ]);
    expect(create).toHaveBeenCalledWith("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "open-question-paste-1:row:0:create",
      context: null,
      id: "question-1",
      projectId: "project-1",
      question: "Which date should we choose?",
      sourceType: "Open Question",
      title: "Choose a launch date",
    });
    expect(update).toHaveBeenCalledWith("account-1", {
      answer: "Ship in June",
      baseRevision: 1,
      clientIdempotencyKey: "open-question-paste-1:row:0:content",
      context: null,
      projectId: "project-1",
      question: "Which date should we choose?",
      sourceId: "question-1",
      sourceType: "Open Question",
      title: "Choose a launch date",
    });
    expect(withWriteTransaction).toHaveBeenCalledTimes(1);
  });

  test("rejects a Milestone status returning to Planned as a validation error", async () => {
    const currentRecord = {
      createdAt: "2026-01-01T00:00:00.000Z",
      description: null,
      id: "milestone-1",
      projectId: "project-1",
      revision: 2,
      sourceType: "Milestone",
      status: "Reached",
      targetDate: null,
      title: "Launch milestone",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as const;
    const transition = vi.fn();
    const projectSourceRecords = {
      find: vi.fn().mockResolvedValue(currentRecord),
      list: vi.fn(),
      transition,
      update: vi.fn(),
    };
    const context = {
      ...createContext().context,
      recordTable: createRecordTableAccess({
        projectShell: { find: vi.fn(), list: vi.fn() } as never,
        projectSourceRecords: projectSourceRecords as never,
        workLifecycle: { list: vi.fn(), updateFields: vi.fn() } as never,
      }),
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.updateTableCell({
        baseRevision: 2,
        clientIdempotencyKey: "milestone-planned-cell-1",
        field: "status",
        projectId: "project-1",
        recordId: "milestone-1",
        recordType: "Milestone",
        value: "Planned",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(transition).not.toHaveBeenCalled();
  });
});
