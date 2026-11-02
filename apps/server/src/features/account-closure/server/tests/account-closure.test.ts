import { ACCOUNT_CLOSURE_START_OPERATION_ID } from "@cantiara/api/account-closure";
import { describe, expect, test } from "vitest";
import { createAccountClosure } from "../account-closure";
import {
  createDrainDouble,
  createExitPackageDouble,
  createMemoryClosureStore,
} from "./account-closure-memory";

const ACTOR = { accountId: "account-1", accountName: "Mert Demirkaya" };
const BOUNDARY = { at: "2026-03-01T00:00:00.000Z", boundaryId: "event-42" };

function setup(drainOverrides = {}) {
  const store = createMemoryClosureStore();
  const { calls, drain } = createDrainDouble(drainOverrides);
  const closure = createAccountClosure({
    boundary: { fix: () => Promise.resolve(BOUNDARY) },
    drain,
    exitPackage: createExitPackageDouble(),
    now: () => new Date("2026-03-01T00:00:00.000Z"),
    store,
  });
  // Grant double from Account Access: one grant per operation, usable once.
  const grants = new Map([[ACCOUNT_CLOSURE_START_OPERATION_ID, "grant-start"]]);
  const consumed: string[] = [];
  const consume = (operationId: string, grant: string) => {
    consumed.push(operationId);
    if (grants.get(operationId as never) === grant) {
      grants.delete(operationId as never);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  };
  return { calls, closure, consume, consumed, store };
}

describe("Close Account start (spec 84)", () => {
  test("a missing, wrong-operation or replayed grant writes nothing", async () => {
    const { calls, closure, consume, store } = setup();
    await expect(
      closure.start(
        ACTOR,
        { grant: "bad", typedName: ACTOR.accountName },
        consume,
      ),
    ).rejects.toMatchObject({ code: "grant_rejected" });
    expect(store.records.size).toBe(0);
    expect(calls).toEqual([]);
    await closure.start(
      ACTOR,
      { grant: "grant-start", typedName: ACTOR.accountName },
      consume,
    );
    // Replay of the same grant after a (cancelled) close attempt is refused.
    store.records.clear();
    await expect(
      closure.start(
        ACTOR,
        { grant: "grant-start", typedName: ACTOR.accountName },
        consume,
      ),
    ).rejects.toMatchObject({ code: "grant_rejected" });
  });

  test("a typed name mismatch writes nothing and never burns the grant", async () => {
    const { closure, consume, consumed, store } = setup();
    await expect(
      closure.start(
        ACTOR,
        { grant: "grant-start", typedName: "Other" },
        consume,
      ),
    ).rejects.toMatchObject({ code: "name_mismatch" });
    expect(consumed).toEqual([]);
    expect(store.records.size).toBe(0);
  });

  test("the grant is consumed once for the start operation id; one card, no second proof", async () => {
    const { closure, consume, consumed } = setup();
    await closure.start(
      ACTOR,
      { grant: "grant-start", typedName: ACTOR.accountName },
      consume,
    );
    expect(consumed).toEqual([ACCOUNT_CLOSURE_START_OPERATION_ID]);
  });

  test("success drains fail-closed, cancels pre-barrier work, settles irreversible work, then freezes", async () => {
    const { calls, closure, consume } = setup();
    const { receipt, record } = await closure.start(
      ACTOR,
      { grant: "grant-start", typedName: ACTOR.accountName },
      consume,
    );
    expect(calls).toEqual([
      "fail-close",
      "cancel-pre-barrier",
      "settle-irreversible",
    ]);
    expect(receipt?.cancelledBeforeBarrier).toEqual([
      { id: "import-1", kind: "import", status: "cancelled" },
    ]);
    expect(receipt?.failClosed).toMatchObject({
      externalAccessClosed: true,
      githubLoginAndAppRevoked: true,
    });
    expect(receipt?.irreversibleWork[0]?.outcome).toBe("committed");
    expect(record.state).toBe("frozen");
    expect(record.securityBoundary).toEqual(BOUNDARY);
  });

  test("a drain failure leaves Closing, fail-closed, with no freeze and no export", async () => {
    let failing = true as boolean;
    const { closure, consume, store } = setup({
      settleIrreversibleWork: () =>
        failing
          ? Promise.reject(new Error("redaction in flight"))
          : Promise.resolve([]),
    });
    await expect(
      closure.start(
        ACTOR,
        { grant: "grant-start", typedName: ACTOR.accountName },
        consume,
      ),
    ).rejects.toMatchObject({ code: "closing_incomplete" });
    expect(store.records.get(ACTOR.accountId)?.state).toBe("closing");
    await expect(
      closure.authorizeWrite(ACTOR.accountId, "normal"),
    ).rejects.toMatchObject({
      code: "write_rejected",
    });
    await expect(
      closure.authorizeWrite(ACTOR.accountId, "export"),
    ).rejects.toMatchObject({
      code: "write_rejected",
    });
    expect(await closure.externalAccessOpen(ACTOR.accountId)).toBe(false);
    failing = false;
    const resumed = await closure.resume(ACTOR.accountId);
    expect(resumed.record.state).toBe("frozen");
  });

  test("Closing rejects normal writes and external access but keeps access-reducing work", async () => {
    const { closure, store } = setup();
    store.records.set(ACTOR.accountId, {
      accountId: ACTOR.accountId,
      closingStartedAt: "2026-03-01T00:00:00.000Z",
      deletedAt: null,
      freezeEndsAt: null,
      freezeStartedAt: null,
      region: "eu",
      securityBoundary: null,
      state: "closing",
    });
    await expect(
      closure.authorizeWrite(ACTOR.accountId, "normal"),
    ).rejects.toMatchObject({
      code: "write_rejected",
    });
    await closure.authorizeWrite(ACTOR.accountId, "access-reducing");
    await closure.authorizeWrite(ACTOR.accountId, "restore-replay");
    expect(await closure.externalAccessOpen(ACTOR.accountId)).toBe(false);
  });

  test("a second start while closing is refused; living Accounts are fully open", async () => {
    const { closure, consume } = setup();
    await closure.authorizeWrite(ACTOR.accountId, "normal");
    expect(await closure.externalAccessOpen(ACTOR.accountId)).toBe(true);
    await closure.start(
      ACTOR,
      { grant: "grant-start", typedName: ACTOR.accountName },
      consume,
    );
    await expect(
      closure.start(
        ACTOR,
        { grant: "x", typedName: ACTOR.accountName },
        consume,
      ),
    ).rejects.toMatchObject({ code: "already_closing" });
  });

  test("the preview names the 30-day freeze, the password-loss limit and EU residency, and writes nothing", () => {
    const { closure, store } = setup();
    const preview = closure.preview();
    expect(preview.freezeNote).toContain("30 days");
    expect(preview.passwordLossNote).toContain("cannot be read");
    expect(preview.residencyNote).toContain("EU");
    expect(store.records.size).toBe(0);
  });

  test("Close Account is not Project delete and not session revoke: the module exposes neither", () => {
    const { closure } = setup();
    expect(Object.keys(closure)).not.toEqual(
      expect.arrayContaining([
        "deleteProject",
        "revokeSession",
        "closeWorkspace",
      ]),
    );
  });
});
