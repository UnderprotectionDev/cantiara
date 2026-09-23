import type { Context } from "@cantiara/api/context";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type {
  PriorityMetric,
  PriorityMetricDefinitionsCopyMutationValue,
  PriorityMetricMutationContracts,
  PriorityMetricMutationValue,
  PriorityMetricProjectValues,
  PriorityMetricsAccess,
  PriorityMetricValueListItem,
  PriorityMetricValueMutationValue,
} from "@cantiara/api/priority-metrics";
import {
  deletePriorityMetricMutationInputSchema,
  setPriorityMetricValueInputSchema,
} from "@cantiara/api/priority-metrics";
import { getProjectShellConfiguration } from "@cantiara/api/project-shell";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const metric: PriorityMetric = {
  createdAt: "2026-09-20T09:00:00.000Z",
  enabled: true,
  id: "metric-1",
  name: "Evidence strength",
  projectId: "project-1",
  rankDescriptions: {
    High: "Repeated direct evidence.",
    Low: "Limited evidence.",
    Medium: "Some evidence.",
    "Very high": "Strong validated evidence.",
    "Very low": "No supporting evidence.",
  },
  revision: 1,
  shortDescription: "How strongly evidence supports this Work.",
  trashedAt: null,
  updatedAt: "2026-09-20T09:00:00.000Z",
};

const { rankDescriptions } = metric;

const unevaluated: PriorityMetricValueListItem = {
  definition: metric,
  value: null,
  valueRevision: 0,
};

function createAccess(recorded: {
  accountIds: string[];
}): PriorityMetricsAccess {
  return {
    list: (accountId, projectId) => {
      recorded.accountIds.push(accountId);
      return Promise.resolve(projectId === metric.projectId ? [metric] : null);
    },
    projectValues: async (_accountId, projectId) =>
      projectId === metric.projectId
        ? ({
            definitions: [metric],
            values: [],
            valueRevisions: [],
          } satisfies PriorityMetricProjectValues)
        : null,
    trashImpactPreview: async (_accountId, metricId) =>
      metricId === metric.id
        ? {
            attachedExternalSurfaceCount: 0,
            dependentRuleCount: 0,
            dependentViewCount: 0,
            storedWorkValueCount: 3,
          }
        : null,
    values: async (_accountId, workId) =>
      workId === "work-1" ? [unevaluated] : null,
  };
}

function createContext(
  priorityMetrics: PriorityMetricsAccess,
  priorityMetricMutationContracts?: PriorityMetricMutationContracts,
  extras: Partial<Context> = {},
): Context {
  return {
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
    priorityMetricMutationContracts,
    priorityMetrics,
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    ...extras,
  };
}

function createProjectShell(
  name = "Cantiara",
): NonNullable<Context["projectShell"]> {
  const project = {
    configuration: getProjectShellConfiguration("Blank Project"),
    createdAt: "2026-09-20T09:00:00.000Z",
    id: "project-1",
    logo: null,
    name,
    problem: null,
    purpose: null,
    revision: 1,
    scope: null,
    shortCode: "CAN",
    shortCodeLocked: false,
    starterConfiguration: "Blank Project",
    status: "Active",
    targetDate: null,
    updatedAt: "2026-09-20T09:00:00.000Z",
  } as const;
  return {
    create: async () => project,
    find: async (_accountId, projectId) =>
      projectId === project.id ? project : null,
    list: async () => [project],
    recordFirstWork: async () => project,
    updateShortCode: async () => project,
  };
}

function confirmationAccess(
  consume: NonNullable<Context["githubIdentityConfirmation"]>["consume"],
) {
  return {
    consume,
    exchange: async () => "G".repeat(43),
    start: async () => ({
      authorizationUrl: "https://github.example/confirm",
    }),
  } satisfies NonNullable<Context["githubIdentityConfirmation"]>;
}

function createMutationContract<TValue>(
  previousValue: TValue,
  onPayload: (payload: MutationPayload) => void = () => undefined,
  currentRevision = 0,
  transformNextValue: (value: TValue) => TValue = (value) => value,
): MutationContract<TValue> {
  return {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<TValue, TPayload>,
    ) => {
      if (command.kind !== "human") {
        throw new Error("Expected a human Priority metric command.");
      }
      onPayload(command.payload);
      const nextValue = transformNextValue(
        await apply({
          committedAt: "2026-09-20T09:00:00.000Z",
          currentRevision,
          currentValue: previousValue,
          payload: command.payload,
        }),
      );
      return {
        actor: command.actor,
        committedAt: "2026-09-20T09:00:00.000Z",
        id: "receipt-1",
        nextValue,
        origin: {
          clientIdempotencyKey: command.clientIdempotencyKey,
          kind: "human" as const,
        },
        payloadFingerprint: "0".repeat(64),
        previousValue,
        revision: currentRevision + 1,
        targetId: command.targetId,
      };
    },
    replay: async () => null,
  };
}

function createMutationContracts(
  recordedRanks: string[],
  currentMetric: PriorityMetric = metric,
  recordedCopies: MutationPayload[] = [],
) {
  return {
    clearValue: () =>
      createMutationContract<PriorityMetricValueMutationValue>({ value: null }),
    copyDefinitions: () =>
      createMutationContract<PriorityMetricDefinitionsCopyMutationValue>(
        {
          definitions: [],
          sourceProjectId: "project-1",
          targetProjectId: "project-2",
        },
        (payload) => recordedCopies.push(payload),
        0,
        (value) => ({
          ...value,
          definitions: [
            {
              ...metric,
              id: "metric-copy-1",
              projectId: value.targetProjectId,
              revision: 0,
            },
          ],
        }),
      ),
    create: () =>
      createMutationContract<PriorityMetricMutationValue>({ metric: null }),
    delete: () =>
      createMutationContract<PriorityMetricMutationValue>(
        { metric: currentMetric },
        () => undefined,
        currentMetric.revision,
      ),
    restore: () =>
      createMutationContract<PriorityMetricMutationValue>(
        { metric: currentMetric },
        () => undefined,
        currentMetric.revision,
      ),
    setValue: () =>
      createMutationContract<PriorityMetricValueMutationValue>(
        { value: null },
        (payload) => {
          const parsed = setPriorityMetricValueInputSchema.safeParse(payload);
          if (parsed.success) {
            recordedRanks.push(parsed.data.rank);
          }
        },
      ),
    trash: () =>
      createMutationContract<PriorityMetricMutationValue>(
        { metric: currentMetric },
        () => undefined,
        currentMetric.revision,
      ),
    update: () =>
      createMutationContract<PriorityMetricMutationValue>(
        { metric: currentMetric },
        () => undefined,
        currentMetric.revision,
      ),
  } satisfies PriorityMetricMutationContracts;
}

describe("Priority metrics RPC", () => {
  test("lists criteria through the authenticated Project interface", async () => {
    const recorded = { accountIds: [] as string[] };
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess(recorded)),
    });

    await expect(
      client.priorityMetrics({ projectId: "project-1" }),
    ).resolves.toEqual([metric]);
    expect(recorded.accountIds).toEqual(["account-1"]);
  });

  test("copies criterion definitions to another owned Project", async () => {
    const recorded = { accountIds: [] as string[] };
    const recordedCopies: MutationPayload[] = [];
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(recorded),
        createMutationContracts([], metric, recordedCopies),
      ),
    });

    await expect(
      client.copyPriorityMetricDefinitions({
        baseRevision: 0,
        clientIdempotencyKey: "copy-priority-metrics-1",
        sourceProjectId: "project-1",
        targetProjectId: "project-2",
      }),
    ).resolves.toMatchObject([
      { id: "metric-copy-1", projectId: "project-2", revision: 0 },
    ]);
    expect(recorded.accountIds).toEqual([]);
    expect(recordedCopies).toEqual([
      { sourceProjectId: "project-1", targetProjectId: "project-2" },
    ]);
    await expect(
      client.copyPriorityMetricDefinitions({
        baseRevision: 0,
        clientIdempotencyKey: "copy-priority-metrics-same-project",
        sourceProjectId: "project-1",
        targetProjectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("returns an unset value without inventing a rank", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess({ accountIds: [] })),
    });

    await expect(
      client.priorityMetricValues({ workId: "work-1" }),
    ).resolves.toEqual([unevaluated]);
  });

  test("returns the Trash effect preview for an owned criterion", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess({ accountIds: [] })),
    });

    await expect(
      client.priorityMetricTrashImpactPreview({ metricId: "metric-1" }),
    ).resolves.toEqual({
      attachedExternalSurfaceCount: 0,
      dependentRuleCount: 0,
      dependentViewCount: 0,
      storedWorkValueCount: 3,
    });
    await expect(
      client.priorityMetricTrashImpactPreview({ metricId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("does not expose priority values for an inaccessible Work", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess({ accountIds: [] })),
    });

    await expect(
      client.priorityMetricValues({ workId: "work-outside-project" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("stores only the rank chosen by the founder", async () => {
    const recordedRanks: string[] = [];
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts(recordedRanks),
      ),
    });

    await expect(
      client.setPriorityMetricValue({
        baseRevision: 0,
        clientIdempotencyKey: "rank-choice-1",
        metricId: "metric-1",
        projectId: "project-1",
        rank: "High",
        workId: "work-1",
      }),
    ).resolves.toMatchObject({
      metricId: "metric-1",
      rank: "High",
      workId: "work-1",
    });
    expect(recordedRanks).toEqual(["High"]);
  });

  test("creates a Project criterion through the authenticated interface", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([]),
      ),
    });

    await expect(
      client.createPriorityMetric({
        baseRevision: 0,
        clientIdempotencyKey: "create-metric-1",
        name: "Customer urgency",
        projectId: "project-1",
        rankDescriptions,
        shortDescription: "How soon the need needs attention.",
      }),
    ).resolves.toMatchObject({
      enabled: true,
      name: "Customer urgency",
      projectId: "project-1",
    });
  });

  test("updates a Project criterion through the authenticated interface", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([]),
      ),
    });

    await expect(
      client.updatePriorityMetric({
        baseRevision: metric.revision,
        clientIdempotencyKey: "update-metric-1",
        enabled: true,
        metricId: metric.id,
        name: "Evidence quality",
        rankDescriptions,
        shortDescription: "How strongly evidence supports this Work.",
      }),
    ).resolves.toMatchObject({
      enabled: true,
      name: "Evidence quality",
      revision: metric.revision + 1,
    });
  });

  test("trashes a criterion while preserving its enabled state", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([]),
      ),
    });

    await expect(
      client.trashPriorityMetric({
        baseRevision: metric.revision,
        clientIdempotencyKey: "trash-metric-1",
        metricId: metric.id,
      }),
    ).resolves.toMatchObject({
      enabled: true,
      trashedAt: expect.any(String),
    });
  });

  test("restores a criterion with the same identity and enabled state", async () => {
    const trashedMetric: PriorityMetric = {
      ...metric,
      revision: 4,
      trashedAt: "2026-09-20T10:00:00.000Z",
    };
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([], trashedMetric),
      ),
    });

    await expect(
      client.restorePriorityMetric({
        baseRevision: trashedMetric.revision,
        clientIdempotencyKey: "restore-metric-1",
        metricId: trashedMetric.id,
      }),
    ).resolves.toMatchObject({
      enabled: true,
      id: trashedMetric.id,
      revision: trashedMetric.revision + 1,
      trashedAt: null,
    });
  });

  test("permanently deletes a criterion only after project name and GitHub confirmation", async () => {
    const trashedMetric: PriorityMetric = {
      ...metric,
      revision: 4,
      trashedAt: "2026-09-20T10:00:00.000Z",
    };
    const consume = vi
      .fn<NonNullable<Context["githubIdentityConfirmation"]>["consume"]>()
      .mockResolvedValue(true);
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([], trashedMetric),
        {
          githubIdentityConfirmation: confirmationAccess(consume),
          projectShell: createProjectShell(),
        },
      ),
    });

    await expect(
      client.deletePriorityMetric({
        baseRevision: trashedMetric.revision,
        clientIdempotencyKey: "delete-metric-1",
        grant: "one-time-github-grant",
        metricId: trashedMetric.id,
        projectId: trashedMetric.projectId,
        typedProjectName: "Cantiara",
      } as never),
    ).resolves.toEqual({ status: true });
    expect(consume).toHaveBeenCalledWith(
      { accountId: "account-1", sessionId: "session-1" },
      "early-permanent-delete",
      "one-time-github-grant",
      undefined,
    );
  });

  test("fails closed when the early-delete grant cannot be consumed", async () => {
    const trashedMetric: PriorityMetric = {
      ...metric,
      revision: 4,
      trashedAt: "2026-09-20T10:00:00.000Z",
    };
    const consume = vi
      .fn<NonNullable<Context["githubIdentityConfirmation"]>["consume"]>()
      .mockResolvedValue(false);
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([], trashedMetric),
        {
          githubIdentityConfirmation: confirmationAccess(consume),
          projectShell: createProjectShell(),
        },
      ),
    });

    await expect(
      client.deletePriorityMetric({
        baseRevision: trashedMetric.revision,
        clientIdempotencyKey: "delete-metric-no-grant",
        grant: "expired-or-replayed-grant",
        metricId: trashedMetric.id,
        projectId: trashedMetric.projectId,
        typedProjectName: "Cantiara",
      } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("does not consume a grant when the typed Project name does not match", async () => {
    const trashedMetric: PriorityMetric = {
      ...metric,
      revision: 4,
      trashedAt: "2026-09-20T10:00:00.000Z",
    };
    const consume = vi
      .fn<NonNullable<Context["githubIdentityConfirmation"]>["consume"]>()
      .mockResolvedValue(true);
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess({ accountIds: [] }),
        createMutationContracts([], trashedMetric),
        {
          githubIdentityConfirmation: confirmationAccess(consume),
          projectShell: createProjectShell(),
        },
      ),
    });

    await expect(
      client.deletePriorityMetric({
        baseRevision: trashedMetric.revision,
        clientIdempotencyKey: "delete-metric-wrong-name",
        grant: "one-time-github-grant",
        metricId: trashedMetric.id,
        projectId: trashedMetric.projectId,
        typedProjectName: "Wrong Project",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(consume).not.toHaveBeenCalled();
  });

  test("requires project name and grant in the permanent-delete command", () => {
    expect(
      deletePriorityMetricMutationInputSchema.safeParse({
        baseRevision: 4,
        clientIdempotencyKey: "delete-metric-missing-confirmation",
        metricId: "metric-1",
      }).success,
    ).toBe(false);
  });
});
