/**
 * Geri döndürülemez güvenlik olay günlüğü, restore tarafı (spec 85, ADR-0003,
 * ADR-0019). The log is append-only, secret-free, identity-aliased and lives
 * OUTSIDE the primary restore unit: a separate managed project with its own
 * credentials in the same EU region. The guards here run at the port, so an
 * adapter cannot persist a secret or content, and a topology that shares the
 * primary's project or credentials is refused before any restore starts.
 */

import { restoreRuleFor } from "./restore-rules";

export const EU_REGION = "eu" as const;

/** The shape the `security_event` table already stores. */
export interface SecurityLogEvent {
  actorAlias: string;
  id: string;
  occurredAt: string;
  targetAlias: string;
  type: string;
  version: number;
}

export interface LogPlacement {
  /** Identifier of the credential, never the credential itself. */
  credentialId: string;
  projectId: string;
  region: string;
}

export interface LogReadResult {
  events: readonly SecurityLogEvent[];
  /** Opaque position after the last returned event; pass it back to continue. */
  frontier: string;
}

export interface SecurityEventLogPort {
  append: (event: SecurityLogEvent) => Promise<void>;
  placement: () => LogPlacement;
  /** Events strictly after `after` (null = from the start), oldest first. */
  readAfter: (after: string | null) => Promise<LogReadResult>;
}

export type LogGuardCode =
  | "LOG_EVENT_HAS_CONTENT"
  | "LOG_EVENT_NOT_ALIASED"
  | "LOG_EVENT_UNREGISTERED"
  | "LOG_NOT_EU"
  | "LOG_NOT_SEPARATE";

export class SecurityLogGuardError extends Error {
  readonly code: LogGuardCode;

  constructor(code: LogGuardCode, message: string) {
    super(message);
    this.name = "SecurityLogGuardError";
    this.code = code;
  }
}

const ALLOWED_FIELDS = new Set([
  "actorAlias",
  "id",
  "occurredAt",
  "targetAlias",
  "type",
  "version",
]);
const MAX_FIELD_LENGTH = 200;
const EMAIL = /\S+@\S+/;
const URL_LIKE = /\w+:\/\//;
const WHITESPACE = /\s/;
const OPAQUE_SECRET = /[A-Za-z0-9_-]{40,}/;

/** Primary and log must not share a restore unit: project, credentials, EU region. */
export function assertLogOutsidePrimary(
  primary: LogPlacement,
  log: LogPlacement,
): void {
  if (
    log.projectId === primary.projectId ||
    log.credentialId === primary.credentialId
  ) {
    throw new SecurityLogGuardError(
      "LOG_NOT_SEPARATE",
      "The security event log must use its own project and credentials.",
    );
  }
  if (log.region !== EU_REGION || primary.region !== EU_REGION) {
    throw new SecurityLogGuardError(
      "LOG_NOT_EU",
      "The security event log must stay in the EU data region.",
    );
  }
}

/** Rejects any event that could carry a secret, user content or a raw identity. */
export function assertSecretFreeAliasedEvent(event: SecurityLogEvent): void {
  const extra = Object.keys(event).filter((key) => !ALLOWED_FIELDS.has(key));
  if (extra.length > 0) {
    throw new SecurityLogGuardError(
      "LOG_EVENT_HAS_CONTENT",
      `The event carries fields beyond the aliased shape: ${extra.join(", ")}.`,
    );
  }
  for (const key of ["actorAlias", "id", "targetAlias", "type"] as const) {
    const value = event[key];
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > MAX_FIELD_LENGTH ||
      WHITESPACE.test(value) ||
      URL_LIKE.test(value) ||
      OPAQUE_SECRET.test(value)
    ) {
      throw new SecurityLogGuardError(
        "LOG_EVENT_HAS_CONTENT",
        `The event field "${key}" is not an opaque alias or identifier.`,
      );
    }
  }
  if (EMAIL.test(event.actorAlias) || EMAIL.test(event.targetAlias)) {
    throw new SecurityLogGuardError(
      "LOG_EVENT_NOT_ALIASED",
      "The event names an identity instead of an alias.",
    );
  }
  if (!restoreRuleFor(event.type)) {
    throw new SecurityLogGuardError(
      "LOG_EVENT_UNREGISTERED",
      `"${event.type}" has no restore rule.`,
    );
  }
}

/** Wraps an adapter so placement is checked at construction and every append is guarded. */
export function createGuardedSecurityLog(
  inner: SecurityEventLogPort,
  primary: LogPlacement,
): SecurityEventLogPort {
  assertLogOutsidePrimary(primary, inner.placement());
  return {
    append(event) {
      try {
        assertSecretFreeAliasedEvent(event);
      } catch (error) {
        return Promise.reject(error);
      }
      return inner.append(event);
    },
    placement: () => inner.placement(),
    readAfter: (after) => inner.readAfter(after),
  };
}
