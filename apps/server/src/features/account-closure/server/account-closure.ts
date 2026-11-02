import {
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
  type AccountClosureGrantConsumer,
  type AccountClosureRecord,
  type AccountClosureSecurityBoundary,
  type AccountClosureStore,
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
  now?: () => Date;
  store: AccountClosureStore;
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
  const { boundary, drain, store } = options;
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
