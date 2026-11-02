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

  test("a failed removal keeps the freeze and a rerun finishes the job", async () => {
    const { closure, elapse, heal, store } = await frozen(true);
    await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    elapse();
    await expect(
      closure.permanentDelete(CLOSURE_ACTOR.accountId),
    ).rejects.toMatchObject({ code: "removal_incomplete" });
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("frozen");
    heal();
    const record = await closure.permanentDelete(CLOSURE_ACTOR.accountId);
    expect(record.state).toBe("deleted");
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
});
