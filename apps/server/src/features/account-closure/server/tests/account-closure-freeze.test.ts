// biome-ignore-all lint/performance/noAwaitInLoops: Each refused grant is asserted in sequence against one frozen Account.
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

const BOUNDARY = { at: "2026-03-01T00:00:00.000Z", boundaryId: "event-42" };
const STARTED = new Date("2026-03-01T00:00:00.000Z");

async function frozen() {
  const store = createMemoryClosureStore();
  const exitPackage = createExitPackageDouble();
  const deletion = createDeletionDoubles();
  const closure = createAccountClosure({
    boundary: { fix: () => Promise.resolve(BOUNDARY) },
    drain: createDrainDouble().drain,
    exitPackage,
    identity: deletion.identity,
    removal: deletion.removal,
    tombstones: deletion.tombstoneLog,
    now: () => STARTED,
    store,
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
  return { closure, exitPackage, grants, store };
}

describe("Hesap kapanma dondurması (spec 84)", () => {
  test("the freeze is the product-fixed 30 days from a fixed security-event boundary", async () => {
    const { closure } = await frozen();
    const set = await closure.frozenSet(CLOSURE_ACTOR.accountId);
    expect(set?.boundary).toEqual(BOUNDARY);
    expect(Date.parse(set?.endsAt ?? "") - STARTED.getTime()).toBe(
      ACCOUNT_CLOSURE_FREEZE_MS,
    );
    expect(ACCOUNT_CLOSURE_FREEZE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test("normal founder writes and external access stay closed; cancel and export are open", async () => {
    const { closure } = await frozen();
    const id = CLOSURE_ACTOR.accountId;
    await expect(closure.authorizeWrite(id, "normal")).rejects.toMatchObject({
      code: "write_rejected",
    });
    await closure.authorizeWrite(id, "cancel-close");
    await closure.authorizeWrite(id, "export");
    await closure.authorizeWrite(id, "access-reducing");
    await closure.authorizeWrite(id, "restore-replay");
    expect(await closure.externalAccessOpen(id)).toBe(false);
  });

  test("79 selected export stays available on the frozen set, unlike person package (81) wording", async () => {
    const { closure } = await frozen();
    await closure.authorizeWrite(CLOSURE_ACTOR.accountId, "export");
    expect(await closure.frozenSet(CLOSURE_ACTOR.accountId)).not.toBeNull();
  });

  test("new user-initiated redaction needs cancel first; replay and access-reducing obligations continue", async () => {
    const { closure } = await frozen();
    await expect(
      closure.authorizeWrite(CLOSURE_ACTOR.accountId, "redaction"),
    ).rejects.toMatchObject({ code: "cancel_first" });
    await closure.authorizeWrite(CLOSURE_ACTOR.accountId, "restore-replay");
    await closure.authorizeWrite(CLOSURE_ACTOR.accountId, "access-reducing");
  });

  test("cancel consumes its own grant and returns the Account to living", async () => {
    const { closure, grants, store } = await frozen();
    const living = await closure.cancel(
      CLOSURE_ACTOR,
      { grant: "grant-cancel" },
      grants.consume,
    );
    expect(living.state).toBe("living");
    expect(grants.consumed.at(-1)).toBe(ACCOUNT_CLOSURE_CANCEL_OPERATION_ID);
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("living");
    await closure.authorizeWrite(CLOSURE_ACTOR.accountId, "normal");
    expect(await closure.frozenSet(CLOSURE_ACTOR.accountId)).toBeNull();
  });

  test("cancel without a valid grant, with the start grant or replayed leaves the freeze", async () => {
    const { closure, grants, store } = await frozen();
    for (const grant of ["", "grant-start", "bad"]) {
      await expect(
        closure.cancel(CLOSURE_ACTOR, { grant }, grants.consume),
      ).rejects.toMatchObject({ code: "grant_rejected" });
    }
    expect(store.records.get(CLOSURE_ACTOR.accountId)?.state).toBe("frozen");
    await closure.cancel(
      CLOSURE_ACTOR,
      { grant: "grant-cancel" },
      grants.consume,
    );
    await expect(
      closure.cancel(CLOSURE_ACTOR, { grant: "grant-cancel" }, grants.consume),
    ).rejects.toMatchObject({ code: "not_closing" });
  });

  test("cancel is refused while Closing is still draining", async () => {
    const { closure, grants, store } = await frozen();
    const record = store.records.get(CLOSURE_ACTOR.accountId);
    if (record) {
      store.records.set(CLOSURE_ACTOR.accountId, {
        ...record,
        state: "closing",
      });
    }
    await expect(
      closure.cancel(CLOSURE_ACTOR, { grant: "grant-cancel" }, grants.consume),
    ).rejects.toMatchObject({ code: "closing_in_progress" });
  });

  test("82 package is produced for the 30-day window with the password-loss limit stated, and downloads", async () => {
    const { closure, exitPackage } = await frozen();
    const result = await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    expect(exitPackage.produced).toEqual([
      {
        accountId: CLOSURE_ACTOR.accountId,
        downloadWindowMs: ACCOUNT_CLOSURE_FREEZE_MS,
      },
    ]);
    expect(result.passwordLossNote).toContain("cannot be read");
    const bytes = await closure.downloadExitPackage(
      CLOSURE_ACTOR.accountId,
      result.download.token,
    );
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("producing and downloading the package keeps the EU region unchanged", async () => {
    const { closure, store } = await frozen();
    const before = store.records.get(CLOSURE_ACTOR.accountId);
    const result = await closure.produceExitPackage(
      CLOSURE_ACTOR.accountId,
      "correct horse battery",
    );
    await closure.downloadExitPackage(
      CLOSURE_ACTOR.accountId,
      result.download.token,
    );
    const after = store.records.get(CLOSURE_ACTOR.accountId);
    expect(after?.region).toBe("eu");
    expect(after).toEqual(before);
  });

  test("the package is not available outside the freeze", async () => {
    const store = createMemoryClosureStore();
    const deletion = createDeletionDoubles();
    const closure = createAccountClosure({
      boundary: { fix: () => Promise.resolve(BOUNDARY) },
      drain: createDrainDouble().drain,
      exitPackage: createExitPackageDouble(),
      identity: deletion.identity,
      removal: deletion.removal,
      tombstones: deletion.tombstoneLog,
      store,
    });
    await expect(
      closure.produceExitPackage(
        CLOSURE_ACTOR.accountId,
        "correct horse battery",
      ),
    ).rejects.toMatchObject({ code: "not_frozen" });
    await expect(
      closure.downloadExitPackage(CLOSURE_ACTOR.accountId, "token-1"),
    ).rejects.toMatchObject({ code: "not_frozen" });
  });
});
