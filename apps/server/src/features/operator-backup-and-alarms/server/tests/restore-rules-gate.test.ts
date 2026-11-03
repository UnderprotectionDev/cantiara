import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_REDACTION_EVENT_TYPE } from "@cantiara/api/security-redaction";
import { TRASH_PERMANENT_DELETE_EVENT_TYPE } from "@cantiara/api/trash";
import { describe, expect, test } from "vitest";

import {
  dueTombstones,
  TOMBSTONE_GRACE_MS,
  tombstonePurgeAt,
  tombstoneRetentionMs,
} from "../account-tombstone-retention";
import {
  RESTORE_RULES,
  restoreRuleFor,
  unregisteredEventTypes,
} from "../restore-rules";

const here = import.meta.dirname;
const featuresDir = join(here, "../../..");
const apiSrc = join(here, "../../../../../../../packages/api/src");

const WRITER =
  /securityEvent|SecurityEvent|EVENT_TYPE|[A-Z]_EVENT\b|AuditRecord|audit\??\.record/;
const EVENT_LITERAL =
  /"([a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+)"/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ["tests", "node_modules", "operator-backup-and-alarms"].includes(
        entry.name,
      )
        ? []
        : sourceFiles(path);
    }
    return entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".gen.ts")
      ? [path]
      : [];
  });
}

/** Every dotted event-type literal in a file that writes security events or audit records. */
function writtenEventTypes(): string[] {
  const types = new Set<string>();
  for (const file of [...sourceFiles(featuresDir), ...sourceFiles(apiSrc)]) {
    const text = readFileSync(file, "utf8");
    if (!WRITER.test(text)) {
      continue;
    }
    for (const match of text.matchAll(EVENT_LITERAL)) {
      types.add(match[1] as string);
    }
  }
  return [...types];
}

describe("Operator Backup and Alarms: replay-rule ship gate", () => {
  test("every irreversible event type the repository writes has a restore rule", () => {
    const written = writtenEventTypes();
    expect(written.length).toBeGreaterThan(15);
    expect(unregisteredEventTypes(written)).toEqual([]);
  });

  test("the gate fails on a newly introduced unregistered type", () => {
    expect(
      unregisteredEventTypes([...writtenEventTypes(), "vault.wiped"]),
    ).toEqual(["vault.wiped"]);
  });

  test("the rule table is not satisfied by inherited object keys", () => {
    expect(restoreRuleFor("constructor")).toBeUndefined();
    expect(restoreRuleFor("__proto__")).toBeUndefined();
  });

  test("the producers named in the spec are registered with a denying or rotating rule", () => {
    const expected: Record<string, string> = {
      "account.deleted": "erase-account",
      "document.external-surface-cancelled": "close-surface",
      "integration.credential-rotated": "rotate-key",
      "key.version-rotated": "rotate-key",
      "link-sharing.password-changed": "invalidate-secret",
      "link-sharing.surface-revoked": "close-surface",
      "link-sharing.token-rotated": "invalidate-secret",
      [SECURITY_REDACTION_EVENT_TYPE]: "redact-record",
      "session.revoked": "revoke-session",
      [TRASH_PERMANENT_DELETE_EVENT_TYPE]: "remove-record",
    };
    for (const [type, effect] of Object.entries(expected)) {
      expect(RESTORE_RULES[type]?.effect, type).toBe(effect);
    }
  });
});

describe("Operator Backup and Alarms: Hesap silme tombstone retention", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const windowMs = 35 * DAY;

  test("is the longest backup window plus 30 days", () => {
    expect(TOMBSTONE_GRACE_MS).toBe(30 * DAY);
    expect(tombstoneRetentionMs(windowMs)).toBe(65 * DAY);
    expect(() => tombstoneRetentionMs(0)).toThrow(RangeError);
  });

  test("a tombstone survives until the retention ends, then is due for physical deletion", () => {
    const deletedAt = new Date("2026-01-01T00:00:00Z");
    const tombstone = { deletedAt, id: "t1" };
    const purgeAt = tombstonePurgeAt(deletedAt, windowMs);
    expect(
      dueTombstones([tombstone], new Date(purgeAt.getTime() - 1), windowMs),
    ).toEqual([]);
    expect(dueTombstones([tombstone], purgeAt, windowMs)).toEqual([tombstone]);
  });
});
