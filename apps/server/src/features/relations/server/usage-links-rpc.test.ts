import type { Context } from "@cantiara/api/context";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type {
  UsageLink,
  UsageLinkMutationContracts,
  UsageLinkMutationValue,
  UsageLinkPayload,
  UsageLinksAccess,
} from "@cantiara/api/relations";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const link: UsageLink = {
  createdAt: "2026-09-20T10:00:00.000Z",
  id: "usage-link-1",
  kind: "Live block",
  location: { blockId: "block-1" },
  revision: 1,
  source: { recordId: "work-1", recordType: "Work" },
  surface: { recordId: "document-1", recordType: "Document" },
};

function createContext(
  usageLinks: UsageLinksAccess,
  usageLinkMutationContracts: UsageLinkMutationContracts,
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
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    usageLinkMutationContracts,
    usageLinks,
  };
}

function createMutationContract(
  currentValue: UsageLink | null,
): MutationContract<UsageLinkMutationValue> {
  return {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<UsageLinkMutationValue, TPayload>,
    ) => {
      const previousValue = { usageLink: currentValue };
      const nextValue = await apply({
        currentRevision: currentValue?.revision ?? 0,
        currentValue: previousValue,
        payload: command.payload,
      });
      return {
        actor: command.actor,
        committedAt: "2026-09-20T10:00:00.000Z",
        id: "receipt-1",
        nextValue,
        origin: {
          clientIdempotencyKey:
            command.kind === "human"
              ? command.clientIdempotencyKey
              : "source-delivery",
          kind: "human" as const,
        },
        payloadFingerprint: "0".repeat(64),
        previousValue,
        revision: (currentValue?.revision ?? 0) + 1,
        targetId: command.targetId,
      };
    },
    replay: async () => null,
  };
}

function createAccess(): UsageLinksAccess {
  return {
    create: vi.fn().mockResolvedValue(link),
    find: vi.fn().mockResolvedValue(link),
    listBySource: vi.fn().mockResolvedValue([link]),
    unlink: vi.fn().mockResolvedValue(true),
  };
}

describe("Usage Links RPC", () => {
  test("lists, creates, and unlinks a usage link through Relations", async () => {
    const usageLinks = createAccess();
    const usageLinkMutationContracts: UsageLinkMutationContracts = {
      create: () => createMutationContract(null),
      unlink: () => createMutationContract(link),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(usageLinks, usageLinkMutationContracts),
    });

    await expect(
      client.usageLinks({
        source: { recordId: "work-1", recordType: "Work" },
      }),
    ).resolves.toEqual([link]);

    const created = await client.createUsageLink({
      baseRevision: 0,
      clientIdempotencyKey: "create-usage-link-1",
      kind: link.kind,
      location: link.location,
      source: link.source,
      surface: link.surface,
    });
    expect(created).toMatchObject({
      kind: "Live block",
      source: link.source,
      surface: link.surface,
    });

    await expect(
      client.unlinkUsageLink({
        baseRevision: 1,
        clientIdempotencyKey: "unlink-usage-link-1",
        usageLinkId: link.id,
      }),
    ).resolves.toEqual({ status: true });
  });

  test("rejects Related before a mutation is requested", async () => {
    const create = vi.fn(() => createMutationContract(null));
    const usageLinks = createAccess();
    const client = createRouterClient(appRouter, {
      context: createContext(usageLinks, {
        create,
        unlink: () => createMutationContract(link),
      }),
    });

    await expect(
      client.createUsageLink({
        baseRevision: 0,
        clientIdempotencyKey: "create-related-as-usage",
        kind: "Related" as UsageLinkPayload["kind"],
        source: link.source,
        surface: link.surface,
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
