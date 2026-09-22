import type { Context } from "@cantiara/api/context";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type {
  PriorityMetric,
  PriorityMetricMutationContracts,
  PriorityMetricMutationValue,
  PriorityMetricProjectValues,
  PriorityMetricsAccess,
  PriorityMetricValueListItem,
  PriorityMetricValueMutationValue,
} from "@cantiara/api/priority-metrics";
import { setPriorityMetricValueInputSchema } from "@cantiara/api/priority-metrics";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

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
          } satisfies PriorityMetricProjectValues)
        : null,
    values: async (_accountId, workId) =>
      workId === "work-1" ? [unevaluated] : null,
  };
}

function createContext(
  priorityMetrics: PriorityMetricsAccess,
  priorityMetricMutationContracts?: PriorityMetricMutationContracts,
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
  };
}

function createMutationContract<TValue>(
  previousValue: TValue,
  onPayload: (payload: MutationPayload) => void = () => undefined,
  currentRevision = 0,
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
      const nextValue = await apply({
        currentRevision,
        currentValue: previousValue,
        payload: command.payload,
      });
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
) {
  return {
    clearValue: () =>
      createMutationContract<PriorityMetricValueMutationValue>({ value: null }),
    create: () =>
      createMutationContract<PriorityMetricMutationValue>({ metric: null }),
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

  test("returns an unset value without inventing a rank", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess({ accountIds: [] })),
    });

    await expect(
      client.priorityMetricValues({ workId: "work-1" }),
    ).resolves.toEqual([unevaluated]);
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

  test("trashes a criterion without exposing it as enabled", async () => {
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
      enabled: false,
      trashedAt: expect.any(String),
    });
  });
});
