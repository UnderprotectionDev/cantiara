import { z } from "zod";

import type { ConfirmGitHubIdentityOperationId } from "./context";

/**
 * Security Redaction (spec 78): the product-facing, irreversible content
 * removal interface. This slice (#504) owns the preview and the apply gate:
 * ownership, the typed Account or Project name (never the record title), then
 * the Account Access `Confirm GitHub Identity` grant consumed exactly once for
 * the `security-redaction` operation. #505 spreads the removal across the
 * closed targets right after the grant is consumed; the event and replay are
 * #506. The sensitive value is a transient input: it is never
 * stored, logged or echoed in any response.
 */

export const REDACT_LABEL = "Redact";
/** Shown for a broken reference to redacted content; never a last-known body. */
export const REDACTED_FOR_SECURITY_LABEL = "Redacted for security";
/** The content-free mark that takes the place of a removed value inside a copy. */
export const REDACTED_VALUE_MARK = "value redacted";
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

/** How one spread target ended. Counts only; never a value or an excerpt. */
export interface SecurityRedactionTargetOutcome {
  /** Copies cleaned in this target. */
  copies: number;
  kind: SecurityRedactionLocatorKind;
  /**
   * `removed` the target held copies and they are gone; `nothing-found` the
   * target is wired and held none; `no-stored-copy` the target is derived from
   * another one and keeps no copy of its own; `not-wired` no store exists yet,
   * so the target was not cleaned and is not claimed clean.
   */
  status: "removed" | "nothing-found" | "no-stored-copy" | "not-wired";
}

export interface SecurityRedactionSpreadResult {
  targets: SecurityRedactionTargetOutcome[];
}

/** What apply returns once the grant is consumed and the spread ran. */
export interface SecurityRedactionGateResult {
  passedAt: string;
  removal: SecurityRedactionSpreadResult;
  scope: SecurityRedactionScope;
  status: "redacted";
}

/** What both the locator sources and the spread port receive. */
export interface SecurityRedactionRequest {
  accountId: string;
  scope: SecurityRedactionScope;
  sensitiveValue: string;
}

/**
 * The one removal interface: current content, every history revision,
 * External Surface snapshots, search, export staging and cache. Apply calls it
 * only after the grant is consumed; 81 and 84 reach it through apply and never
 * reimplement it.
 */
export interface SecurityRedactionSpread {
  spread: (
    request: SecurityRedactionRequest,
  ) => Promise<SecurityRedactionSpreadResult>;
}

/**
 * One spread target. `remove` is irreversible and returns the number of
 * copies cleaned; a `null` return means the target keeps no copy of its own.
 */
export interface SecurityRedactionTargetAdapter {
  kind: SecurityRedactionLocatorKind;
  remove: (request: SecurityRedactionRequest) => Promise<number | null>;
}

/** Some targets failed; the value is gone from the others. Names kinds only. */
export class SecurityRedactionSpreadIncompleteError extends Error {
  readonly code = "SECURITY_REDACTION_SPREAD_INCOMPLETE" as const;
  readonly failed: SecurityRedactionLocatorKind[];

  constructor(failed: SecurityRedactionLocatorKind[]) {
    super("Redaction did not reach every copy.");
    this.name = "SecurityRedactionSpreadIncompleteError";
    this.failed = failed;
  }
}

/**
 * Replaces every occurrence of `value` inside one string with the content-free
 * mark. Pure and idempotent.
 */
export function redactText(text: string, value: string): string {
  return value && text.includes(value)
    ? text.split(value).join(REDACTED_VALUE_MARK)
    : text;
}

/**
 * Deep-redacts strings (and object keys) inside a JSON value, keeping its
 * shape. `changed` tells the caller whether a copy was found.
 */
export function redactJson(
  input: unknown,
  value: string,
): { changed: boolean; value: unknown } {
  if (typeof input === "string") {
    const next = redactText(input, value);
    return { changed: next !== input, value: next };
  }
  if (Array.isArray(input)) {
    let changed = false;
    const items = input.map((item) => {
      const result = redactJson(item, value);
      changed ||= result.changed;
      return result.value;
    });
    return { changed, value: changed ? items : input };
  }
  if (input && typeof input === "object") {
    let changed = false;
    const entries = Object.entries(input).map(([key, item]) => {
      const result = redactJson(item, value);
      const nextKey = redactText(key, value);
      changed ||= result.changed || nextKey !== key;
      return [nextKey, result.value] as const;
    });
    return { changed, value: changed ? Object.fromEntries(entries) : input };
  }
  return { changed: false, value: input };
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
   * grant is consumed exactly once, then the spread runs. `null` when the
   * Project is not the Account's. Throws
   * `SecurityRedactionSpreadIncompleteError` when a wired target failed.
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
