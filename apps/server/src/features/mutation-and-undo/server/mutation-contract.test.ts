import {
  fingerprintMutationPayload,
  type MutationActor,
  type MutationCommand,
  type MutationHistoryEntry,
  type MutationPayload,
  type MutationReceipt,
  type MutationTarget,
  type NonHumanMutationActor,
} from "@cantiara/api/mutation-and-undo";
import { describe, expect, test } from "vitest";
import {
  createMutationContract,
  type MutationCommitInput,
  MutationConflictError,
  type MutationContractStore,
  type MutationIdempotencyKey,
  type MutationStaleBaseRevisionError,
} from "./mutation-contract";

interface FixtureValue {
  title: string;
}

interface OriginCase {
  actor: MutationActor;
  label: string;
  sourceId?: string;
}

const ORIGIN_CASES = [
  {
    actor: { actorId: "account-1", type: "User" },
    label: "User",
  },
  {
    actor: { actorId: "automation-1", type: "System automation" },
    label: "System automation",
    sourceId: "automation-source-1",
  },
  {
    actor: { actorId: "github-1", type: "GitHub" },
    label: "GitHub",
    sourceId: "github-source-1",
  },
  {
    actor: {
      actorId: "integration-1",
      authorizingUserId: "account-1",
      type: "Authorized integration",
    },
    label: "Authorized integration",
    sourceId: "integration-source-1",
  },
] satisfies OriginCase[];

async function commandForOrigin(
  origin: OriginCase,
  title: string,
  revision: number,
  key: string,
): Promise<MutationCommand<{ title: string }>> {
  const payload = { title };
  if (origin.actor.type === "User") {
    return {
      actor: origin.actor,
      baseRevision: revision,
      clientIdempotencyKey: key,
      kind: "human",
      payload,
      targetId: "work-1",
    };
  }

  return {
    actor: origin.actor,
    kind: "non-human",
    payload,
    source: {
      deliveryId: key,
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: origin.sourceId ?? `${key}-source`,
    },
    targetId: "work-1",
    targetRevision: revision,
  };
}

function createMemoryStore(initial: MutationTarget<FixtureValue>) {
  let target = initial;
  let commitQueue = Promise.resolve();
  const receipts = new Map<string, MutationReceipt<FixtureValue>>();
  const history: MutationHistoryEntry<FixtureValue>[] = [];
  const receiptKey = ({ key, scope }: MutationIdempotencyKey) =>
    `${scope}:${key}`;
  const store: MutationContractStore<FixtureValue> = {
    findReceipt(key) {
      return Promise.resolve(receipts.get(receiptKey(key)) ?? null);
    },
    getTarget() {
      return Promise.resolve(target);
    },
    async commit<TPayload extends MutationPayload>(
      input: MutationCommitInput<FixtureValue, TPayload>,
    ) {
      const previousCommit = commitQueue;
      let release: () => void = () => undefined;
      commitQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previousCommit;

      try {
        const existing = receipts.get(receiptKey(input.idempotencyKey));
        if (existing) {
          return existing.payloadFingerprint === input.payloadFingerprint
            ? { receipt: existing, status: "replayed" as const }
            : { status: "conflict" as const };
        }
        if (target.revision !== input.expectedRevision) {
          return { current: target, status: "stale" as const };
        }

        const nextValue = await input.apply({
          currentRevision: target.revision,
          currentValue: target.value,
          payload: input.payload,
        });
        const receipt = {
          actor: input.actor,
          committedAt: input.committedAt,
          id: input.receiptId,
          nextValue,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value,
          revision: target.revision + 1,
          targetId: target.id,
        };
        target = {
          id: target.id,
          revision: receipt.revision,
          value: nextValue,
        };
        receipts.set(receiptKey(input.idempotencyKey), receipt);
        history.push({
          actor: input.actor,
          id: input.historyId,
          nextValue,
          occurredAt: input.committedAt,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: receipt.previousValue,
          revision: receipt.revision,
          targetId: target.id,
        });
        return { receipt, status: "committed" as const };
      } finally {
        release();
      }
    },
  };
  return { getHistory: () => history, getTarget: () => target, store };
}

describe("Mutation Contract seam", () => {
  test("fingerprints equivalent JSON payloads canonically", async () => {
    await expect(
      fingerprintMutationPayload({
        nested: { second: true, first: "value" },
        title: "Updated",
      }),
    ).resolves.toBe(
      await fingerprintMutationPayload({
        title: "Updated",
        nested: { first: "value", second: true },
      }),
    );
  });

  test("applies a human command with its base revision and client key", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });

    const receipt = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "client-key-1",
        kind: "human",
        payload: { title: "Updated" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        ...payload,
      }),
    );

    expect(receipt).toMatchObject({
      actor: { actorId: "account-1", type: "User" },
      nextValue: { title: "Updated" },
      previousValue: { title: "Original" },
      revision: 1,
      targetId: "work-1",
    });
    expect(receipt.id).toEqual(expect.any(String));
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Updated" },
    });
  });

  test("returns the original receipt when a human command is retried", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    let applyCalls = 0;
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "client-key-1",
      kind: "human" as const,
      payload: { title: "Updated" },
      targetId: "work-1",
    };

    const first = await contract.mutate(command, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });
    const retry = await contract.mutate(command, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });

    expect(retry).toEqual(first);
    expect(applyCalls).toBe(1);
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Updated" },
    });
  });

  test("rejects a reused human key when its payload changes", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "client-key-1",
      kind: "human" as const,
      payload: { title: "Updated" },
      targetId: "work-1",
    };

    await contract.mutate(command, ({ payload }) => payload);

    await expect(
      contract.mutate(
        { ...command, payload: { title: "Different update" } },
        ({ payload }) => payload,
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);
    await expect(
      contract.mutate(
        { ...command, payload: { title: "Different update" } },
        ({ payload }) => payload,
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      label: "Conflict",
      targetId: "work-1",
    });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Updated" },
    });
  });

  test("rejects a stale human base and exposes the Current value", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });

    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "client-key-1",
        kind: "human",
        payload: { title: "First update" },
        targetId: "work-1",
      },
      ({ payload }) => payload,
    );

    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: "client-key-2",
          kind: "human",
          payload: { title: "Stale update" },
          targetId: "work-1",
        },
        ({ payload }) => payload,
      ),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: 1,
      currentValue: { title: "First update" },
      label: "Current value",
    } satisfies Partial<MutationStaleBaseRevisionError<FixtureValue>>);
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "First update" },
    });
  });

  test("accepts a non-human command only with a verified source", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const payload = { title: "From GitHub" };
    const payloadFingerprint = await fingerprintMutationPayload(payload);
    const verifiedSources: string[] = [];
    const contract = createMutationContract({
      sourceVerifier: {
        verify: ({ actor, source }) => {
          verifiedSources.push(`${actor.type}:${source.sourceId}`);
          return source.sourceId === "github-installation-1";
        },
      },
      store: memory.store,
    });

    const receipt = await contract.mutate(
      {
        actor: { actorId: "installation-1", type: "GitHub" },
        kind: "non-human",
        payload,
        source: {
          deliveryId: "delivery-1",
          payloadFingerprint: payloadFingerprint.toUpperCase(),
          sourceId: "github-installation-1",
        },
        targetId: "work-1",
        targetRevision: 0,
      },
      ({ payload: nextValue }) => nextValue,
    );

    expect(receipt).toMatchObject({
      actor: { actorId: "installation-1", type: "GitHub" },
      nextValue: payload,
      origin: {
        deliveryId: "delivery-1",
        kind: "source",
        sourceId: "github-installation-1",
      },
      payloadFingerprint,
    });
    expect(verifiedSources).toEqual(["GitHub:github-installation-1"]);
  });

  test("returns a non-human receipt on redelivery and conflicts on a changed payload", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const source = {
      sourceId: "automation-1",
      deliveryId: "delivery-1",
    };
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    let applyCalls = 0;
    const firstPayload = { title: "Automated update" };
    const firstCommand = {
      actor: { actorId: "rule-1", type: "System automation" as const },
      kind: "non-human" as const,
      payload: firstPayload,
      source: {
        ...source,
        payloadFingerprint: await fingerprintMutationPayload(firstPayload),
      },
      targetId: "work-1",
      targetRevision: 0,
    };

    const first = await contract.mutate(firstCommand, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });
    const redelivery = await contract.mutate(firstCommand, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });
    const changedPayload = { title: "Changed replay" };

    await expect(
      contract.mutate(
        {
          ...firstCommand,
          payload: changedPayload,
          source: {
            ...source,
            payloadFingerprint:
              await fingerprintMutationPayload(changedPayload),
          },
        },
        ({ payload }) => payload,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", label: "Conflict" });

    expect(redelivery).toEqual(first);
    expect(applyCalls).toBe(1);
    expect(memory.getTarget()).toMatchObject({
      revision: 1,
      value: firstPayload,
    });
  });

  test("keeps source delivery idempotency stable when actor metadata changes", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const payload = { title: "External update" };
    const source = {
      deliveryId: "delivery-1",
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: "source-1",
    };

    const first = await contract.mutate(
      {
        actor: { actorId: "automation-1", type: "System automation" },
        kind: "non-human",
        payload,
        source,
        targetId: "work-1",
        targetRevision: 0,
      },
      ({ payload: nextValue }) => nextValue,
    );
    const redelivery = await contract.mutate(
      {
        actor: { actorId: "automation-2", type: "System automation" },
        kind: "non-human",
        payload,
        source,
        targetId: "work-1",
        targetRevision: 0,
      },
      ({ payload: nextValue }) => nextValue,
    );

    expect(redelivery).toEqual(first);
    expect(memory.getHistory()).toHaveLength(1);
  });

  test("rejects an unverified source or a payload fingerprint mismatch", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const payload = { title: "External update" };
    const source = {
      deliveryId: "delivery-1",
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: "unregistered-source",
    };
    const command = {
      actor: {
        actorId: "integration-1",
        type: "Authorized integration" as const,
        authorizingUserId: "account-1",
      },
      kind: "non-human" as const,
      payload,
      source,
      targetId: "work-1",
      targetRevision: 0,
    };

    await expect(
      createMutationContract({ store: memory.store }).mutate(
        command,
        ({ payload: nextValue }) => nextValue,
      ),
    ).rejects.toMatchObject({ code: "UNVERIFIED_SOURCE" });
    await expect(
      createMutationContract({
        sourceVerifier: { verify: () => true },
        store: memory.store,
      }).mutate(
        {
          ...command,
          source: { ...source, payloadFingerprint: "0".repeat(64) },
        },
        ({ payload: nextValue }) => nextValue,
      ),
    ).rejects.toMatchObject({ code: "INVALID_PAYLOAD_FINGERPRINT" });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
  });

  test("records all four origin classes in Kayıt geçmişi", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const applyTitle = ({
      currentValue,
      payload,
    }: {
      currentValue: FixtureValue;
      payload: { title: string };
    }) => ({
      ...currentValue,
      ...payload,
    });

    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "human-1",
        kind: "human",
        payload: { title: "User update" },
        targetId: "work-1",
      },
      applyTitle,
    );

    const mutateFromSource = async (
      actor: NonHumanMutationActor,
      sourceId: string,
      deliveryId: string,
      targetRevision: number,
      title: string,
    ) => {
      const payload = { title };
      return contract.mutate(
        {
          actor,
          kind: "non-human",
          payload,
          source: {
            deliveryId,
            payloadFingerprint: await fingerprintMutationPayload(payload),
            sourceId,
          },
          targetId: "work-1",
          targetRevision,
        },
        applyTitle,
      );
    };

    await mutateFromSource(
      { actorId: "automation-1", type: "System automation" },
      "automation-source-1",
      "automation-delivery-1",
      1,
      "Automation update",
    );
    await mutateFromSource(
      { actorId: "github-installation-1", type: "GitHub" },
      "github-source-1",
      "github-delivery-1",
      2,
      "GitHub update",
    );
    await mutateFromSource(
      {
        actorId: "integration-1",
        authorizingUserId: "account-1",
        type: "Authorized integration",
      },
      "integration-source-1",
      "integration-delivery-1",
      3,
      "Integration update",
    );

    expect(memory.getHistory().map(({ actor }) => actor)).toEqual([
      { actorId: "account-1", type: "User" },
      { actorId: "automation-1", type: "System automation" },
      { actorId: "github-installation-1", type: "GitHub" },
      {
        actorId: "integration-1",
        authorizingUserId: "account-1",
        type: "Authorized integration",
      },
    ]);
  });

  test("rejects one of two concurrent writes from the same base", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const command = (clientIdempotencyKey: string, title: string) => ({
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey,
      kind: "human" as const,
      payload: { title },
      targetId: "work-1",
    });

    const outcomes = await Promise.allSettled([
      contract.mutate(
        command("client-key-1", "First"),
        ({ payload }) => payload,
      ),
      contract.mutate(
        command("client-key-2", "Second"),
        ({ payload }) => payload,
      ),
    ]);

    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    const rejected = outcomes.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      reason: { code: "STALE_BASE_REVISION" },
      status: "rejected",
    });
    expect(memory.getTarget().revision).toBe(1);
    expect(memory.getHistory()).toHaveLength(1);
  });

  test("uses the target revision condition when source deliveries arrive out of order", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const applyTitle = ({
      payload,
    }: {
      currentValue: FixtureValue;
      payload: { title: string };
    }) => payload;
    const delivery = async (
      deliveryId: string,
      targetRevision: number,
      title: string,
    ) => {
      const payload = { title };
      return contract.mutate(
        {
          actor: { actorId: "automation-1", type: "System automation" },
          kind: "non-human",
          payload,
          source: {
            deliveryId,
            payloadFingerprint: await fingerprintMutationPayload(payload),
            sourceId: "automation-source-1",
          },
          targetId: "work-1",
          targetRevision,
        },
        applyTitle,
      );
    };

    await expect(
      delivery("delivery-2", 1, "Second delivery"),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: 0,
      currentValue: { title: "Original" },
    });
    await delivery("delivery-1", 0, "First delivery");
    await delivery("delivery-2", 1, "Second delivery");

    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 2,
      value: { title: "Second delivery" },
    });
  });

  test.each(ORIGIN_CASES)(
    "$label retries, rejects reordered writes, and serializes concurrent writes",
    async (origin) => {
      const memory = createMemoryStore({
        id: "work-1",
        revision: 0,
        value: { title: "Original" },
      });
      const contract = createMutationContract({
        sourceVerifier: { verify: () => true },
        store: memory.store,
      });
      const applyTitle = ({ payload }: { payload: { title: string } }) =>
        payload;
      const firstCommand = await commandForOrigin(origin, "First", 0, "first");
      const first = await contract.mutate(firstCommand, applyTitle);
      const retry = await contract.mutate(firstCommand, applyTitle);

      expect(retry).toEqual(first);
      expect(memory.getHistory()).toHaveLength(1);

      const reorderedCommand = await commandForOrigin(
        origin,
        "Reordered",
        2,
        "reordered",
      );
      await expect(
        contract.mutate(reorderedCommand, applyTitle),
      ).rejects.toMatchObject({
        code: "STALE_BASE_REVISION",
        currentRevision: 1,
      });
      await contract.mutate(
        await commandForOrigin(origin, "Second", 1, "second"),
        applyTitle,
      );
      await contract.mutate(reorderedCommand, applyTitle);

      const outcomes = await Promise.allSettled([
        contract.mutate(
          await commandForOrigin(origin, "Concurrent first", 3, "parallel-1"),
          applyTitle,
        ),
        contract.mutate(
          await commandForOrigin(origin, "Concurrent second", 3, "parallel-2"),
          applyTitle,
        ),
      ]);

      expect(
        outcomes.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      expect(outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "rejected" }),
          expect.objectContaining({ status: "fulfilled" }),
        ]),
      );
      const rejected = outcomes.find(({ status }) => status === "rejected");
      expect(rejected).toMatchObject({
        reason: { code: "STALE_BASE_REVISION" },
        status: "rejected",
      });
      expect(memory.getTarget().revision).toBe(4);
      expect(memory.getHistory()).toHaveLength(4);
    },
  );

  test("does not apply human commands without their write envelope", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const apply = ({ payload }: { payload: { title: string } }) => payload;

    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          kind: "human",
          payload: { title: "Missing base" },
          targetId: "work-1",
        } as never,
        apply,
      ),
    ).rejects.toThrow();
    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          baseRevision: 0,
          kind: "human",
          payload: { title: "Missing key" },
          targetId: "work-1",
        } as never,
        apply,
      ),
    ).rejects.toThrow();
    await expect(
      contract.mutate(
        {
          actor: { actorId: "automation-1", type: "System automation" },
          baseRevision: 0,
          kind: "non-human",
          payload: { title: "Fake base" },
          source: {
            deliveryId: "delivery-1",
            payloadFingerprint: await fingerprintMutationPayload({
              title: "Fake base",
            }),
            sourceId: "source-1",
          },
          targetId: "work-1",
          targetRevision: 0,
        } as never,
        apply,
      ),
    ).rejects.toThrow();
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
  });
});
