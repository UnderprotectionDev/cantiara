import { z } from "zod";

import type { ConfirmGitHubIdentityOperationId } from "./context";
import type {
  ExitPackageDownload,
  ExitPackageSuccess,
} from "./workspace-exit-package";
import {
  EXIT_NATURE_NOTE,
  EXIT_PASSWORD_NOTE,
  EXIT_RESIDENCY_NOTE,
} from "./workspace-exit-package";

/**
 * Account Closure contract (spec 84, glossary `Hesap kapatma`). One lifecycle
 * for the Account and its single Workspace: living, `Closing` (fail-closed
 * drain), the fixed 30-day Hesap kapanma dondurması, then permanent delete
 * through Security Redaction (78). It is not Project delete (83), not session
 * revoke (01) and not the person package (81). The grant (OAuth/PKCE) stays in
 * Account Access; the typed Account name stays here.
 */

export const CLOSE_ACCOUNT_LABEL = "Close Account";
export const CLOSING_LABEL = "Closing";
export const CANCEL_CLOSING_LABEL = "Cancel closing";

export const ACCOUNT_CLOSURE_START_OPERATION_ID =
  "account-closure-start" satisfies ConfirmGitHubIdentityOperationId;
export const ACCOUNT_CLOSURE_CANCEL_OPERATION_ID =
  "account-closure-cancel" satisfies ConfirmGitHubIdentityOperationId;

/** Product constant (PRD 03). Not a user choice, never a parameter. */
export const ACCOUNT_CLOSURE_FREEZE_DAYS = 30;
export const ACCOUNT_CLOSURE_FREEZE_MS =
  ACCOUNT_CLOSURE_FREEZE_DAYS * 24 * 60 * 60 * 1000;

/** The only region the Account's data lives in until permanent delete (ADR-0009). */
export const ACCOUNT_CLOSURE_REGION = "eu";

export const ACCOUNT_CLOSURE_PASSWORD_LOSS_NOTE = EXIT_PASSWORD_NOTE;
export const ACCOUNT_CLOSURE_RESIDENCY_NOTE = EXIT_RESIDENCY_NOTE;
export const ACCOUNT_CLOSURE_PACKAGE_NOTE = EXIT_NATURE_NOTE;
export const ACCOUNT_CLOSURE_FREEZE_NOTE = `After closing, your Account is held for ${ACCOUNT_CLOSURE_FREEZE_DAYS} days. You can cancel closing or download your Workspace Exit Package during that time. After ${ACCOUNT_CLOSURE_FREEZE_DAYS} days the Account and Workspace are permanently deleted, and only if at least one Workspace Exit Package was produced.`;

export const ACCOUNT_CLOSURE_STATES = [
  "living",
  "closing",
  "frozen",
  /** Permanent delete claimed the Account: cancel is gone, the job may rerun. */
  "deleting",
  "deleted",
] as const;
export type AccountClosureState = (typeof ACCOUNT_CLOSURE_STATES)[number];

export const startAccountClosureInputSchema = z
  .object({
    grant: z.string().min(1).max(512),
    typedName: z.string().min(1).max(200),
  })
  .strict();
export type StartAccountClosureInput = z.input<
  typeof startAccountClosureInputSchema
>;

export const cancelAccountClosureInputSchema = z
  .object({ grant: z.string().min(1).max(512) })
  .strict();
export type CancelAccountClosureInput = z.input<
  typeof cancelAccountClosureInputSchema
>;

/** The Account the founder acts for; the name is the typed-name target. */
export interface AccountClosureActor {
  accountId: string;
  accountName: string;
}

/**
 * Consume the grant only after the refusals the spec names: a lost concurrent
 * transition (another start or cancel wins the CAS) still spends the grant,
 * and no refund exists. The race is an accepted edge: the grant is a fresh
 * Confirm GitHub Identity card either way.
 */
export type AccountClosureGrantConsumer = (
  operationId: ConfirmGitHubIdentityOperationId,
  grant: string,
) => Promise<boolean>;

/** Kinds of write the guard tells apart (PRD 03, spec 84 US4, US7-US9). */
export const ACCOUNT_CLOSURE_WRITE_KINDS = [
  "normal",
  "redaction",
  "cancel-close",
  "export",
  "access-reducing",
  "restore-replay",
] as const;
export type AccountClosureWriteKind =
  (typeof ACCOUNT_CLOSURE_WRITE_KINDS)[number];

export interface AccountClosureRecord {
  accountId: string;
  closingStartedAt: string | null;
  deletedAt: string | null;
  freezeEndsAt: string | null;
  freezeStartedAt: string | null;
  /** Residency never changes with closure, package or download. */
  region: typeof ACCOUNT_CLOSURE_REGION;
  /** The fixed security-event boundary of the frozen dataset. */
  securityBoundary: SecurityEventBoundary | null;
  state: AccountClosureState;
}

export interface SecurityEventBoundary {
  at: string;
  boundaryId: string;
}

/** One receipt per piece of in-flight work (never content). */
export interface PreBarrierCancelReceipt {
  id: string;
  kind: "import" | "upload" | "automation" | "sync";
  status: "cancelled";
}
export interface IrreversibleWorkReceipt {
  id: string;
  kind: "redaction" | "delete";
  outcome: "committed" | "rolled-back";
}
export interface FailClosedReceipt {
  endedSessions: number;
  extensionConnectionsRevoked: number;
  externalAccessClosed: true;
  githubLoginAndAppRevoked: true;
  integrationsClosed: true;
}

export interface ClosingReceipt {
  cancelledBeforeBarrier: PreBarrierCancelReceipt[];
  failClosed: FailClosedReceipt;
  irreversibleWork: IrreversibleWorkReceipt[];
}

/**
 * The drain adapters (01 sessions and GitHub login/App, 14 External Surfaces,
 * 61 integrations and extension connections, 62/71/72 in-flight work, 78
 * irreversible work). Each step throws when it cannot finish; the module then
 * stays in `Closing`, never opens the freeze.
 */
export interface AccountClosureDrain {
  /** Pre-barrier import, upload, automation and sync: cancelled with a receipt. */
  cancelPreBarrierWork: (
    accountId: string,
  ) => Promise<PreBarrierCancelReceipt[]>;
  /** Sharing and publish stop, integrations close, sessions and extensions end. */
  failClose: (accountId: string) => Promise<FailClosedReceipt>;
  /** Post-barrier and already-started irreversible work: full commit or rollback. */
  settleIrreversibleWork: (
    accountId: string,
  ) => Promise<IrreversibleWorkReceipt[]>;
}

export interface AccountClosureSecurityBoundary {
  fix: (accountId: string) => Promise<SecurityEventBoundary>;
}

/**
 * Persistence port. `transition` is a compare-and-set on the state so two
 * concurrent starts or a cancel racing the delete job cannot both win.
 */
export interface AccountClosureStore {
  get: (accountId: string) => Promise<AccountClosureRecord | null>;
  transition: (
    accountId: string,
    from: AccountClosureState,
    next: AccountClosureRecord,
  ) => Promise<boolean>;
}

/** 82, read side only: the module never reimplements the package. The member
 * types are derived from the 82 contract so the shapes cannot drift apart. */
export interface AccountClosureExitPackage {
  download: (token: string) => Promise<Uint8Array>;
  produce: (input: {
    accountId: string;
    downloadWindowMs?: number;
    password: string;
  }) => Promise<{
    download: ExitPackageDownload;
    packageId: string;
  }>;
  successfulProduction: (input: {
    accountId: string;
  }) => Promise<ExitPackageSuccess | null>;
}

/**
 * 78 redaction-and-delete contract as one terminal removal of the Account and
 * its Workspace. Throws when not fully removed; there is no second engine.
 */
export interface AccountClosureRemoval {
  removeAccountAndWorkspace: (accountId: string) => Promise<void>;
}

/**
 * Content-free, irreversible record that 85 replays (pseudonymous alias only).
 */
export interface AccountDeleteTombstone {
  accountAlias: string;
  id: string;
  occurredAt: string;
  /** 85 restore window plus 30 days. */
  retention: "restore-window-plus-30-days";
  type: "account-delete";
  version: 1;
}
export interface AccountClosureTombstoneLog {
  alias: (accountId: string) => Promise<string>;
  /**
   * An idempotent write: the store must replace any earlier tombstone with the
   * same `id`, never append a second entry for one Account (removal failures
   * make the delete job rerun against the irreversible log).
   */
  append: (tombstone: AccountDeleteTombstone) => Promise<void>;
}

/** 01: frees the stable GitHub user id so a later sign-in makes a NEW Account. */
export interface AccountClosureIdentity {
  release: (accountId: string) => Promise<void>;
}

export type AccountClosureErrorCode =
  | "account_closed"
  | "already_closing"
  | "cancel_first"
  | "closing_in_progress"
  | "freeze_elapsed"
  | "freeze_not_elapsed"
  | "grant_rejected"
  | "name_mismatch"
  | "not_closing"
  | "not_frozen"
  | "package_required"
  | "removal_incomplete"
  | "closing_incomplete"
  | "write_rejected";

export class AccountClosureError extends Error {
  readonly code: AccountClosureErrorCode;

  constructor(
    code: AccountClosureErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AccountClosureError";
    this.code = code;
  }
}
