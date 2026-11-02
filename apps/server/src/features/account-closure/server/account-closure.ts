import {
  ACCOUNT_CLOSURE_CANCEL_OPERATION_ID,
  ACCOUNT_CLOSURE_FREEZE_MS,
  ACCOUNT_CLOSURE_FREEZE_NOTE,
  ACCOUNT_CLOSURE_PACKAGE_NOTE,
  ACCOUNT_CLOSURE_PASSWORD_LOSS_NOTE,
  ACCOUNT_CLOSURE_REGION,
  ACCOUNT_CLOSURE_RESIDENCY_NOTE,
  ACCOUNT_CLOSURE_START_OPERATION_ID,
  type AccountClosureActor,
  type AccountClosureDrain,
  AccountClosureError,
  type AccountClosureExitPackage,
  type AccountClosureGrantConsumer,
  type AccountClosureIdentity,
  type AccountClosureRecord,
  type AccountClosureRemoval,
  type AccountClosureSecurityBoundary,
  type AccountClosureStore,
  type AccountClosureTombstoneLog,
  type AccountClosureWriteKind,
  type ClosingReceipt,
  type SecurityEventBoundary,
} from "@cantiara/api/account-closure";

/**
 * Account Closure (spec 84). Gate order of `start` is fixed so a refusal never
 * writes: lifecycle state, the typed Account name (a typo never burns the
 * grant), then the Account Access grant consumed exactly once. Only then the
 * visible `Closing` state is written, and the drain runs. The freeze opens only
 * after the whole drain finished; a failing step leaves `Closing`, which stays
 * fail-closed, and `resume` runs the drain again.
 */

export interface AccountClosureOptions {
  boundary: AccountClosureSecurityBoundary;
  drain: AccountClosureDrain;
  exitPackage: AccountClosureExitPackage;
  identity: AccountClosureIdentity;
  now?: () => Date;
  removal: AccountClosureRemoval;
  store: AccountClosureStore;
  tombstones: AccountClosureTombstoneLog;
}

export interface AccountClosureStatus {
  receipt?: ClosingReceipt;
  record: AccountClosureRecord;
}

export interface AccountClosureStartPreview {
  freezeNote: string;
  packageNote: string;
  passwordLossNote: string;
  residencyNote: string;
}

const LIVING = (accountId: string): AccountClosureRecord => ({
  accountId,
  closingStartedAt: null,
  deletedAt: null,
  freezeEndsAt: null,
  freezeStartedAt: null,
  region: ACCOUNT_CLOSURE_REGION,
  securityBoundary: null,
  state: "living",
});

/** What each lifecycle state lets through (PRD 03; spec 84 US4, US7-US9). */
const ALLOWED: Record<
  AccountClosureRecord["state"],
  readonly AccountClosureWriteKind[]
> = {
  closing: ["access-reducing", "restore-replay"],
  deleted: [],
  frozen: ["cancel-close", "export", "access-reducing", "restore-replay"],
  living: [
    "normal",
    "redaction",
    "export",
    "access-reducing",
    "restore-replay",
  ],
};

export function createAccountClosure(options: AccountClosureOptions) {
  const { boundary, drain, exitPackage, identity, removal, store, tombstones } =
    options;
  const now = options.now ?? (() => new Date());

  async function current(accountId: string): Promise<AccountClosureRecord> {
    return (await store.get(accountId)) ?? LIVING(accountId);
  }

  async function runDrain(
    record: AccountClosureRecord,
  ): Promise<AccountClosureStatus> {
    const { accountId } = record;
    let receipt: ClosingReceipt;
    let fixed: SecurityEventBoundary;
    try {
      // Fail-closed first, then pre-barrier work is cancelled, then work past
      // the barrier reaches its full commit or rollback receipt.
      const failClosed = await drain.failClose(accountId);
      const cancelledBeforeBarrier =
        await drain.cancelPreBarrierWork(accountId);
      const irreversibleWork = await drain.settleIrreversibleWork(accountId);
      receipt = { cancelledBeforeBarrier, failClosed, irreversibleWork };
      fixed = await boundary.fix(accountId);
    } catch (error) {
      throw Object.assign(
        new AccountClosureError(
          "closing_incomplete",
          "Closing did not finish. The Account stays closed to normal work and can continue closing.",
        ),
        { cause: error },
      );
    }
    const startedAt = now();
    const frozen: AccountClosureRecord = {
      ...record,
      freezeEndsAt: new Date(
        startedAt.getTime() + ACCOUNT_CLOSURE_FREEZE_MS,
      ).toISOString(),
      freezeStartedAt: startedAt.toISOString(),
      securityBoundary: fixed,
      state: "frozen",
    };
    if (!(await store.transition(accountId, "closing", frozen))) {
      throw new AccountClosureError(
        "closing_incomplete",
        "Closing changed while it was finishing.",
      );
    }
    return { receipt, record: frozen };
  }

  async function requireFrozen(accountId: string) {
    if ((await current(accountId)).state !== "frozen") {
      throw new AccountClosureError(
        "not_frozen",
        "The Workspace Exit Package is available while the Account is on hold.",
      );
    }
  }

  return {
    /** Read-only notes shown before `Close Account`; writes nothing. */
    preview(): AccountClosureStartPreview {
      return {
        freezeNote: ACCOUNT_CLOSURE_FREEZE_NOTE,
        packageNote: ACCOUNT_CLOSURE_PACKAGE_NOTE,
        passwordLossNote: ACCOUNT_CLOSURE_PASSWORD_LOSS_NOTE,
        residencyNote: ACCOUNT_CLOSURE_RESIDENCY_NOTE,
      };
    },

    status: current,

    async start(
      actor: AccountClosureActor,
      input: { grant: string; typedName: string },
      consumeGrant: AccountClosureGrantConsumer,
    ): Promise<AccountClosureStatus> {
      const existing = await current(actor.accountId);
      if (existing.state !== "living") {
        throw new AccountClosureError(
          existing.state === "deleted" ? "account_closed" : "already_closing",
          "This Account is already closing.",
        );
      }
      if (input.typedName !== actor.accountName) {
        throw new AccountClosureError(
          "name_mismatch",
          "Type the Account name exactly to close it.",
        );
      }
      if (
        !(await consumeGrant(ACCOUNT_CLOSURE_START_OPERATION_ID, input.grant))
      ) {
        throw new AccountClosureError(
          "grant_rejected",
          "Confirm GitHub Identity again to close the Account.",
        );
      }
      const closing: AccountClosureRecord = {
        ...existing,
        closingStartedAt: now().toISOString(),
        state: "closing",
      };
      if (!(await store.transition(actor.accountId, "living", closing))) {
        throw new AccountClosureError(
          "already_closing",
          "This Account is already closing.",
        );
      }
      return runDrain(closing);
    },

    /**
     * Cancel is as serious as start: the Account Access grant for
     * `account-closure-cancel`, consumed once. Open for the whole freeze;
     * success returns the Account to living (revoked surfaces, sessions and
     * integrations stay revoked: they are not undeleted).
     */
    async cancel(
      actor: AccountClosureActor,
      input: { grant: string },
      consumeGrant: AccountClosureGrantConsumer,
    ): Promise<AccountClosureRecord> {
      const existing = await current(actor.accountId);
      if (existing.state === "deleted") {
        throw new AccountClosureError(
          "account_closed",
          "This Account was permanently deleted.",
        );
      }
      if (existing.state === "closing") {
        throw new AccountClosureError(
          "closing_in_progress",
          "Closing is still finishing. Cancel closing opens when the hold starts.",
        );
      }
      if (existing.state !== "frozen") {
        throw new AccountClosureError("not_closing", "Nothing is closing.");
      }
      if (
        !(await consumeGrant(ACCOUNT_CLOSURE_CANCEL_OPERATION_ID, input.grant))
      ) {
        throw new AccountClosureError(
          "grant_rejected",
          "Confirm GitHub Identity again to cancel closing.",
        );
      }
      const living = LIVING(actor.accountId);
      if (!(await store.transition(actor.accountId, "frozen", living))) {
        throw new AccountClosureError(
          "account_closed",
          "The Account is no longer on hold.",
        );
      }
      return living;
    },

    /**
     * The frozen dataset (fixed security-event boundary) that 79 selected
     * export and 82 read; `null` outside the freeze.
     */
    async frozenSet(
      accountId: string,
    ): Promise<{ boundary: SecurityEventBoundary; endsAt: string } | null> {
      const record = await current(accountId);
      return record.state === "frozen" &&
        record.securityBoundary &&
        record.freezeEndsAt
        ? { boundary: record.securityBoundary, endsAt: record.freezeEndsAt }
        : null;
    },

    /**
     * Produces the 82 Workspace Exit Package for the frozen set and keeps it
     * downloadable for the 30-day window. Producing or downloading never
     * touches the record, so residency stays EU.
     */
    async produceExitPackage(accountId: string, password: string) {
      await requireFrozen(accountId);
      const production = await exitPackage.produce({
        accountId,
        downloadWindowMs: ACCOUNT_CLOSURE_FREEZE_MS,
        password,
      });
      return {
        ...production,
        passwordLossNote: ACCOUNT_CLOSURE_PASSWORD_LOSS_NOTE,
      };
    },

    async downloadExitPackage(
      accountId: string,
      token: string,
    ): Promise<Uint8Array> {
      await requireFrozen(accountId);
      return exitPackage.download(token);
    },

    /**
     * The job at the end of the freeze. There is no early path: it refuses
     * before 30 days and without at least one successful 82 production. Order
     * is fixed so a crash stays replayable: the content-free tombstone first
     * (85 replays it), then the one 78 removal, then the GitHub id is freed,
     * then the record closes for good. A failed removal leaves the freeze, so
     * the job can run again.
     */
    async permanentDelete(accountId: string): Promise<AccountClosureRecord> {
      const record = await current(accountId);
      if (record.state === "deleted") {
        throw new AccountClosureError(
          "account_closed",
          "This Account was permanently deleted.",
        );
      }
      if (record.state !== "frozen" || !record.freezeEndsAt) {
        throw new AccountClosureError(
          "not_frozen",
          "Only an Account on hold can be permanently deleted.",
        );
      }
      if (now().getTime() < Date.parse(record.freezeEndsAt)) {
        throw new AccountClosureError(
          "freeze_not_elapsed",
          "The 30-day hold has not ended.",
        );
      }
      if (!(await exitPackage.successfulProduction({ accountId }))) {
        throw new AccountClosureError(
          "package_required",
          "Produce a Workspace Exit Package before the Account can be deleted.",
        );
      }
      const deletedAt = now().toISOString();
      try {
        await tombstones.append({
          accountAlias: await tombstones.alias(accountId),
          id: `account-delete:${accountId}`,
          occurredAt: deletedAt,
          retention: "restore-window-plus-30-days",
          type: "account-delete",
          version: 1,
        });
        await removal.removeAccountAndWorkspace(accountId);
        await identity.release(accountId);
      } catch (error) {
        throw Object.assign(
          new AccountClosureError(
            "removal_incomplete",
            "Permanent delete did not finish. The Account stays on hold and the job can run again.",
          ),
          { cause: error },
        );
      }
      const deleted: AccountClosureRecord = {
        ...record,
        deletedAt,
        state: "deleted",
      };
      if (!(await store.transition(accountId, "frozen", deleted))) {
        throw new AccountClosureError(
          "account_closed",
          "The Account is no longer on hold.",
        );
      }
      return deleted;
    },

    /** Runs the drain again for an Account left in `Closing`. */
    async resume(accountId: string): Promise<AccountClosureStatus> {
      const record = await current(accountId);
      if (record.state !== "closing") {
        throw new AccountClosureError("not_closing", "Nothing is closing.");
      }
      return runDrain(record);
    },

    /** Does this kind of write pass for the Account's lifecycle state? */
    async authorizeWrite(
      accountId: string,
      kind: AccountClosureWriteKind,
    ): Promise<void> {
      const { state } = await current(accountId);
      if (ALLOWED[state].includes(kind)) {
        return;
      }
      if (state === "deleted") {
        throw new AccountClosureError(
          "account_closed",
          "This Account was permanently deleted.",
        );
      }
      if (state === "frozen" && kind === "redaction") {
        throw new AccountClosureError(
          "cancel_first",
          "Cancel closing before redacting.",
        );
      }
      throw new AccountClosureError(
        "write_rejected",
        state === "closing"
          ? "The Account is closing. Normal changes are not accepted."
          : "The Account is closed. Only cancelling and exporting are available.",
      );
    },

    /** External sharing, publish and sessions stay closed outside `living`. */
    async externalAccessOpen(accountId: string): Promise<boolean> {
      return (await current(accountId)).state === "living";
    },
  };
}

export type AccountClosure = ReturnType<typeof createAccountClosure>;
