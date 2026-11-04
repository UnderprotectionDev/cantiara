/**
 * Replay-rule registry (spec 85, ADR-0003, ADR-0019). Every irreversible
 * security-event type that a producer writes registers here what a restore
 * must do when the append-only log is newer than the restored primary. A type
 * that is not registered cannot ship: the ship-gate test derives the written
 * types from the repository and fails on any that is missing. The producers
 * (01/77/78/14/76/73/84, rotation) own their own replay tests; this registry
 * is the runner's rule table, not a second copy of their behavior.
 */

/** What the restore target must do for one event. `none` = no access effect. */
export type RestoreEffectKind =
  | "close-surface"
  | "consume-single-use"
  | "erase-account"
  | "invalidate-secret"
  | "none"
  | "redact-record"
  | "remove-record"
  | "revoke-capture-link"
  | "revoke-session"
  | "rotate-key";

export interface RestoreRule {
  effect: RestoreEffectKind;
  /** Spec number of the producing feature, or a short owner label. */
  owner: string;
  /** True when the producer does not write this type yet (rule is reserved). */
  planned?: boolean;
}

/** Effects after which the target must refuse the named subject. */
export const DENYING_EFFECTS: ReadonlySet<RestoreEffectKind> = new Set([
  "close-surface",
  "consume-single-use",
  "erase-account",
  "invalidate-secret",
  "redact-record",
  "remove-record",
  "revoke-capture-link",
  "revoke-session",
]);

const none = (owner: string): RestoreRule => ({ effect: "none", owner });

export const RESTORE_RULES: Readonly<Record<string, RestoreRule>> = {
  // 01 Account Access
  "session.revoked": { effect: "revoke-session", owner: "01" },
  "tauri.auth-code.consumed": { effect: "consume-single-use", owner: "01" },
  "github.identity-confirmation.started": none("01"),
  "github.identity-confirmation.succeeded": none("01"),
  "github.identity-confirmation.failed": none("01"),
  // 77 Trash and permanent delete
  "trash.permanently-deleted": { effect: "remove-record", owner: "77" },
  "priority-metric.permanently-deleted": {
    effect: "remove-record",
    owner: "77",
  },
  "trash.surface-revoked": { effect: "close-surface", owner: "77" },
  "trash.surface-kept": none("77"),
  // 78 Security redaction, personal data rights
  "security-redaction.applied": { effect: "redact-record", owner: "78" },
  "personal-data.erased": { effect: "redact-record", owner: "78" },
  "personal-data.exported": none("78"),
  // 14 / 76 / 73 external surface, token, password
  "document.external-surface-cancelled": {
    effect: "close-surface",
    owner: "14",
  },
  "link-sharing.surface-revoked": { effect: "close-surface", owner: "73" },
  "link-sharing.sessions-revoked": { effect: "revoke-session", owner: "73" },
  "link-sharing.token-rotated": { effect: "invalidate-secret", owner: "73" },
  "link-sharing.password-changed": {
    effect: "invalidate-secret",
    owner: "73",
  },
  "web-capture-link.revoked": { effect: "revoke-capture-link", owner: "36" },
  // 73 audit-only entries: written to the audit record class, not restore-relevant
  "link-sharing.share-created": none("73"),
  "link-sharing.share-reshared": none("73"),
  "link-sharing.share-reopened": none("73"),
  "link-sharing.share-revoked": none("73"),
  "link-sharing.expiry-changed": none("73"),
  "link-sharing.password-rotated": none("73"),
  "link-sharing.gate-failed": none("73"),
  // 84 account delete, integrations, key rotation: reserved until produced
  "account.deleted": { effect: "erase-account", owner: "84", planned: true },
  "integration.credential-rotated": {
    effect: "rotate-key",
    owner: "integrations",
    planned: true,
  },
  "key.version-rotated": { effect: "rotate-key", owner: "keys", planned: true },
};

export function restoreRuleFor(type: string): RestoreRule | undefined {
  return Object.hasOwn(RESTORE_RULES, type) ? RESTORE_RULES[type] : undefined;
}

/** Ship gate: returns every written event type that has no restore rule. */
export function unregisteredEventTypes(
  writtenTypes: Iterable<string>,
): string[] {
  return [...new Set(writtenTypes)]
    .filter((type) => !restoreRuleFor(type))
    .sort();
}
