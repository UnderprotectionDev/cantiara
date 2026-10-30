import { z } from "zod";

import type { ConfirmGitHubIdentityOperationId } from "./context";

/**
 * Security Redaction (spec 78): the product-facing, irreversible content
 * removal interface. This slice (#504) owns the preview and the apply gate:
 * ownership, the typed Account or Project name (never the record title), then
 * the Account Access `Confirm GitHub Identity` grant consumed exactly once for
 * the `security-redaction` operation. Removal and propagation are #505, the
 * event and replay #506. The sensitive value is a transient input: it is never
 * stored, logged or echoed in any response.
 */

export const REDACT_LABEL = "Redact";
export const CONFIRM_GITHUB_IDENTITY_LABEL = "Confirm GitHub Identity";
export const SECURITY_REDACTION_OPERATION_ID =
  "security-redaction" satisfies ConfirmGitHubIdentityOperationId;

/** The PRD 13 limit the preview states: no secret detection in free Markdown. */
export const SECURITY_REDACTION_DETECTION_LIMIT =
  "Cantiara does not detect secrets in free Markdown. This preview lists only the places that hold the value you entered.";

/** The closed spread targets; callers never add their own. */
export const SECURITY_REDACTION_LOCATOR_KINDS = [
  "current-field",
  "history-revision",
  "external-surface-snapshot",
  "search-index",
  "export-staging",
  "cache",
] as const;
export type SecurityRedactionLocatorKind =
  (typeof SECURITY_REDACTION_LOCATOR_KINDS)[number];

export const SECURITY_REDACTION_LOCATOR_LABELS: Record<
  SecurityRedactionLocatorKind,
  string
> = {
  cache: "Cache",
  "current-field": "Current field",
  "export-staging": "Export staging",
  "external-surface-snapshot": "External Surface snapshot",
  "history-revision": "History revision",
  "search-index": "Search index",
};

export const securityRedactionScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Account") }).strict(),
  z
    .object({
      kind: z.literal("Project"),
      projectId: z.string().trim().min(1).max(255),
    })
    .strict(),
]);
export type SecurityRedactionScope = z.infer<
  typeof securityRedactionScopeSchema
>;

const sensitiveValue = z.string().min(1).max(4096);

export const securityRedactionPreviewInputSchema = z
  .object({ scope: securityRedactionScopeSchema, sensitiveValue })
  .strict();
export type SecurityRedactionPreviewInput = z.input<
  typeof securityRedactionPreviewInputSchema
>;

export const applySecurityRedactionInputSchema = z
  .object({
    grant: z.string().min(1).max(512),
    scope: securityRedactionScopeSchema,
    sensitiveValue,
    typedName: z.string().min(1).max(200),
  })
  .strict();
export type ApplySecurityRedactionInput = z.input<
  typeof applySecurityRedactionInputSchema
>;

/** Where a copy lives. Never carries the value or any excerpt of it. */
export interface SecurityRedactionLocator {
  kind: SecurityRedactionLocatorKind;
  /** The field, revision number or index name inside the record. */
  location: string;
  recordId: string;
  recordKind: string;
}

export interface SecurityRedactionPreview {
  /** Always stated: the product does not detect secrets in free Markdown. */
  detectionLimit: string;
  locators: SecurityRedactionLocator[];
  /** Spread targets with no registered source yet: not searched, not clean. */
  notSearched: SecurityRedactionLocatorKind[];
  /** The name the founder must type: the affected Account or Project. */
  typedNameTarget: { kind: "Account" | "Project"; name: string };
}

/**
 * What #504 returns after the gate: honest about removal. `removal` becomes
 * a real result when #505 implements `SecurityRedactionSpread`.
 */
export interface SecurityRedactionGateResult {
  passedAt: string;
  removal: "not-performed";
  scope: SecurityRedactionScope;
  status: "gate-passed";
}

/** What both the locator sources and the spread port receive. */
export interface SecurityRedactionRequest {
  accountId: string;
  scope: SecurityRedactionScope;
  sensitiveValue: string;
}

/**
 * The port #505 implements: removal from current content, every history
 * revision, External Surface snapshots, search, export staging and cache. It
 * is called by the apply gate only after the grant is consumed.
 */
export interface SecurityRedactionSpread {
  spread: (request: SecurityRedactionRequest) => Promise<unknown>;
}

/** Finds the copies of one value in one spread target; reads only. */
export interface SecurityRedactionLocatorSource {
  kind: SecurityRedactionLocatorKind;
  locate: (
    request: SecurityRedactionRequest,
  ) => Promise<SecurityRedactionLocator[]>;
}

export class SecurityRedactionTypedNameMismatchError extends Error {
  readonly code = "SECURITY_REDACTION_TYPED_NAME_MISMATCH" as const;

  constructor() {
    super("The typed name does not match.");
    this.name = "SecurityRedactionTypedNameMismatchError";
  }
}

export class SecurityRedactionGrantRejectedError extends Error {
  readonly code = "SECURITY_REDACTION_GRANT_REJECTED" as const;

  constructor() {
    super(`${CONFIRM_GITHUB_IDENTITY_LABEL} is required to redact.`);
    this.name = "SecurityRedactionGrantRejectedError";
  }
}

/** The signed-in Account: its id and the name its Account-scope redaction types. */
export interface SecurityRedactionActor {
  accountId: string;
  accountName: string;
}

/** Consumes the Account Access grant for `security-redaction`; `false` fails closed. */
export type SecurityRedactionGrantConsumer = (
  grant: string,
) => Promise<boolean>;

export interface SecurityRedactionAccess {
  /**
   * Fixed order so a refusal never writes: ownership, typed name, then the
   * grant is consumed exactly once. `null` when the Project is not the
   * Account's. Performs no removal in #504.
   */
  apply: (
    actor: SecurityRedactionActor,
    input: ApplySecurityRedactionInput,
    consumeGrant: SecurityRedactionGrantConsumer,
  ) => Promise<SecurityRedactionGateResult | null>;
  /** Read-only: lists locators, deletes and writes nothing. */
  preview: (
    actor: SecurityRedactionActor,
    input: SecurityRedactionPreviewInput,
  ) => Promise<SecurityRedactionPreview | null>;
}
