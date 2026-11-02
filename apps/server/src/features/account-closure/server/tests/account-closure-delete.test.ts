// biome-ignore-all lint/performance/noAwaitInLoops: Each write kind is asserted in sequence against one deleted Account.
import {
  ACCOUNT_CLOSURE_CANCEL_OPERATION_ID,
  ACCOUNT_CLOSURE_FREEZE_MS,
  ACCOUNT_CLOSURE_START_OPERATION_ID,
} from "@cantiara/api/account-closure";
import { describe, expect, test } from "vitest";
import { createAccountClosure } from "../account-closure";
import {
  CLOSURE_ACTOR,
  createDeletionDoubles,
  createDrainDouble,
  createExitPackageDouble,
  createGrantDouble,
  createMemoryClosureStore,
} from "./account-closure-memory";

const START = new Date("2026-03-01T00:00:00.000Z");
const GITHUB_USER = "github-user-9";

async function frozen(removalFails = false) {
  const clock = { at: START };
  const store = createMemoryClosureStore();
  const exitPackage = createExitPackageDouble();
  const deletion = createDeletionDoubles();
  // The original Account owns the stable GitHub id until it is released.
  deletion.directory.set(GITHUB_USER, CLOSURE_ACTOR.accountId);
  let failing = removalFails;
  const closure = createAccountClosure({
    boundary: {
      fix: () =>
        Promise.resolve({ at: START.toISOString(), boundaryId: "e-1" }),
    },
    drain: createDrainDouble().drain,
    exitPackage,
    identity: deletion.identity,
    now: () => clock.at,
    removal: {
      removeAccountAndWorkspace: (accountId) => {
        if (failing) {
          return Promise.reject(new Error("78 spread incomplete"));
        }
        return deletion.removal.removeAccountAndWorkspace(accountId);
      },
    },
    store,
    tombstones: deletion.tombstoneLog,
  });
  const grants = createGrantDouble({
    [ACCOUNT_CLOSURE_CANCEL_OPERATION_ID]: "grant-cancel",
    [ACCOUNT_CLOSURE_START_OPERATION_ID]: "grant-start",
  });
  await closure.start(
    CLOSURE_ACTOR,
    { grant: "grant-start", typedName: CLOSURE_ACTOR.accountName },
    grants.consume,
  );
  return {
    closure,
    deletion,
    elapse: () => {
      clock.at = new Date(START.getTime() + ACCOUNT_CLOSURE_FREEZE_MS);
    },
    exitPackage,
    heal: () => {
      failing = false;
    },
    store,
  };
}

describe("Permanent delete (spec 84)", () => {
  test("there is no early path: before 30 days nothing is removed", async () => {
    const { closure, deletion } = await frozen();
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "freeze_not_elapsed" });
    expect(deletion.calls).toEqual([]);
  });

  test("without a successful 82 production the delete job refuses", async () => {
    const { closure, deletion, elapse } = await frozen();
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "package_required" });
    expect(deletion.calls).toEqual([]);
  });

  test("a living or closing Account cannot be deleted", async () => {
    const store = createMemoryClosureStore();
    const deletion = createDeletionDoubles();
    const closure = createAccountClosure({
      boundary: { fix: () => Promise.reject(new Error("unused")) },
      drain: createDrainDouble().drain,
      exitPackage: createExitPackageDouble(),
      identity: deletion.identity,
      removal: deletion.removal,
      store,
      tombstones: deletion.tombstoneLog,
    });
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "not_frozen" });
  });

  test("after 30 days and a package, 78 removes the Account once, after the tombstone", async () => {
    const { closure, deletion, elapse, store } = await frozen();
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    const record = await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    expect(deletion.calls).toEqual([
      "tombstone",
      `remove:${CLOSURE_ACTOR.accountId}`,
      "release-identity",
    ]);
    expect(record.state).toBe("deleted");
    expect(record.region).toBe("eu");
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("deleted");
  });

  test("the tombstone is content-free: a pseudonymous alias, never the name or id", async () => {
    const { closure, deletion, elapse } = await frozen();
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    expect(deletion.tombstones).toHaveLength(1);
    const serialized = JSON.stringify(deletion.tombstones[0]);
    expect(serialized).not.toContain(CLOSURE_ACTOR.accountName);
    expect(deletion.tombstones[0]).toMatchObject({
      accountAlias: "alias-7f3a",
      retention: "restore-window-plus-30-days",
      type: "account-delete",
    });
  });

  test("a failed removal keeps the freeze and a rerun finishes the job without a second tombstone", async () => {
    const { closure, deletion, elapse, heal, store } = await frozen(true);
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "removal_incomplete" });
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("deleting");
    expect(deletion.tombstones).toHaveLength(1);
    const [first] = deletion.tombstones;
    expect(first).toBeDefined();
    heal();
    const record = await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    expect(record.state).toBe("deleted");
    // The irreversible log keeps one entry per Account: the rerun upserts.
    expect(deletion.tombstones).toHaveLength(1);
    expect(deletion.tombstones[0]).toEqual(first);
  });

  test("while a removal is claimed, the security obligations keep passing and normal work stays closed", async () => {
    const { closure, elapse, store } = await frozen(true);
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "removal_incomplete" });
    await closure.authorizeWrite(CLOSURE_ACTOR.accountId, "access-reducing");
    await closure.authorizeWrite(CLOSURE_ACTOR.accountId, "restore-replay");
    await expect(
      closure.authorizeWrite(CLOSURE_ACTOR.accountId, "normal"),
    ).rejects.toMatchObject({ code: "account_closed" });
    expect(await closure.externalAccessOpen(CLOSURE_ACTOR.accountId)).toBe(
      false,
    );
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("deleting");
  });

  test("after delete the old Account id has no session, surface or workspace write, and cannot cancel", async () => {
    const { closure, elapse } = await frozen();
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    for (const kind of [
      "normal",
      "export",
      "cancel-close",
      "redaction",
    ] as const) {
      await expect(
        closure.authorizeWrite(CLOSURE_ACTOR.accountId, kind),
      ).rejects.toMatchObject({ code: "account_closed" });
    }
    expect(await closure.externalAccessOpen(CLOSURE_ACTOR.accountId)).toBe(
      false,
    );
    await expect(
      closure.cancel(CLOSURE_ACTOR, { grant: "grant-cancel" }, () =>
        Promise.resolve(true),
      ),
    ).rejects.toMatchObject({ code: "account_closed" });
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "account_closed" });
  });

  test("the same GitHub id later gets a different Account id and does not resurrect the old one", async () => {
    const { closure, deletion, elapse } = await frozen();
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    const next = deletion.signIn(GITHUB_USER);
    expect(next).not.toBe(CLOSURE_ACTOR.accountId);
    await closure.authorizeWrite(next, "normal");
    await expect(
      closure.authorizeWrite(CLOSURE_ACTOR.accountId, "normal"),
    ).rejects.toMatchObject({ code: "account_closed" });
  });

  test("once delete is claimed, cancel is refused and a rerun resumes", async () => {
    const { closure, elapse, store } = await frozen(true);
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "removal_incomplete" });
    await expect(
      closure.cancel(CLOSURE_ACTOR, { grant: "x" }, () =>
        Promise.resolve(true),
      ),
    ).rejects.toMatchObject({ code: "account_closed" });
    await expect(
      closure.authorizeWrite(CLOSURE_ACTOR.accountId, "normal"),
    ).rejects.toMatchObject({ code: "account_closed" });
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("deleting");
  });

  test("cancel is refused once the 30 days have ended, and the package no longer starts", async () => {
    const { closure, elapse } = await frozen();
    elapse();
    await expect(
      closure.cancel(CLOSURE_ACTOR, { grant: "x" }, () =>
        Promise.resolve(true),
      ),
    ).rejects.toMatchObject({ code: "freeze_elapsed" });
    await expect(
      closure.produceExitPackage(
        CLOSURE_ACTOR.accountId,
        "correct horse battery",
      ),
    ).rejects.toMatchObject({ code: "not_frozen" });
  });

  test("the gate compares instants, not strings: a stale non-Zulu package stamp cannot pass", async () => {
    const { closure, elapse, exitPackage } = await frozen();
    // Lexicographically this sorts after the freeze start, but as an instant
    // it is 2026-02-28T23:00:00Z, the day before the freeze began.
    exitPackage.successfulProduction = () =>
      Promise.resolve({
        packageId: "stale-offset",
        producedAt: "2026-03-01T02:00:00+03:00",
      });
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "package_required" });
  });

  test("an unparsable package stamp fails closed", async () => {
    const { closure, elapse, exitPackage } = await frozen();
    exitPackage.successfulProduction = () =>
      Promise.resolve({
        packageId: "unparsable",
        producedAt: "not a timestamp",
      });
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "package_required" });
  });

  test("after delete, package production and download answer account_closed, not a hold message", async () => {
    const { closure, elapse } = await frozen();
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    await expect(
      closure.produceExitPackage(
        CLOSURE_ACTOR.accountId,
        "correct horse battery",
      ),
    ).rejects.toMatchObject({ code: "account_closed" });
    await expect(
      closure.downloadExitPackage(CLOSURE_ACTOR.accountId, "token-1"),
    ).rejects.toMatchObject({ code: "account_closed" });
  });

  test("a package from an earlier freeze does not satisfy the gate", async () => {
    const { closure, elapse, exitPackage } = await frozen();
    exitPackage.successfulProduction = () =>
      Promise.resolve({
        packageId: "old",
        producedAt: "2026-01-01T00:00:00.000Z",
      });
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "package_required" });
  });
});
