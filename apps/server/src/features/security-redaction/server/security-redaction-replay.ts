import { createHmac, timingSafeEqual } from "node:crypto";

import {
  parseSecurityRedactionScopeAlias,
  SECURITY_REDACTION_REPLAY_KEY_VERSION,
  type SecurityRedactionEvent,
  type SecurityRedactionEventLog,
  type SecurityRedactionReplayLocator,
  type SecurityRedactionScope,
  type SecurityRedactionSpread,
} from "@cantiara/api/security-redaction";

/**
 * Replay locator and replay of Security Redaction events (spec 78 #506).
 * The event cannot carry the value, yet a restore from an older backup can
 * bring it back, so the event carries a locator instead: a random salt, the
 * value length and HMAC-SHA256(key, salt + value) under a server-only key.
 * A plain hash would let anyone holding the log guess a short secret; the
 * keyed digest does not. Replay slides a window of that length over the
 * restored text, and a window whose digest matches is the value again. It is
 * then handed to the same `SecurityRedactionSpread` that apply uses: replay
 * is a second trigger for the one removal engine, never a second engine.
 */

/**
 * A key of its own derived from the server secret, so the replay digest of a
 * redaction event cannot be recomputed without it.
 */
export function deriveSecurityRedactionReplayKey(secret: string) {
  return createHmac("sha256", secret)
    .update("security-redaction:replay:v1")
    .digest("hex");
}

function digestOf(key: string, salt: string, value: string) {
  return createHmac("sha256", key)
    .update(salt)
    .update("\0")
    .update(value)
    .digest("hex");
}

export function securityRedactionReplayLocator(
  key: string,
  value: string,
  salt: string,
): SecurityRedactionReplayLocator {
  return {
    digest: digestOf(key, salt, value),
    keyVersion: SECURITY_REDACTION_REPLAY_KEY_VERSION,
    length: value.length,
    salt,
  };
}

function sameDigest(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The window of `text` that the locator describes, or `null`. */
export function findReplayValue(
  key: string,
  locator: SecurityRedactionReplayLocator,
  text: string,
): string | null {
  const { digest, length, salt } = locator;
  if (length <= 0 || text.length < length) {
    return null;
  }
  for (let start = 0; start + length <= text.length; start += 1) {
    const candidate = text.slice(start, start + length);
    if (sameDigest(digestOf(key, salt, candidate), digest)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Every readable string of the restored stores in one scope: the anchor where
 * replay finds the value again. Reads only. One surviving copy is enough,
 * because the spread then cleans every target.
 */
export type SecurityRedactionReplayTexts = (request: {
  accountId: string;
  scope: SecurityRedactionScope;
}) => Promise<readonly string[]>;

export interface SecurityRedactionReplayResult {
  /** Events whose value was found again and removed. */
  reapplied: number;
  /** Events whose digest was made by an older server key; rotation orphaned them. */
  staleKey: number;
  /** Events whose scope alias or stored row could not be read; never skipped silently. */
  unreadable: number;
}

export interface SecurityRedactionReplay {
  /** Re-applies every logged redaction to a restored store, before access opens. */
  replay: () => Promise<SecurityRedactionReplayResult>;
}

export function createSecurityRedactionReplay(options: {
  events: SecurityRedactionEventLog;
  key: string;
  spread: SecurityRedactionSpread;
  texts: SecurityRedactionReplayTexts;
}): SecurityRedactionReplay {
  const { key, spread, texts } = options;

  async function reapply(event: SecurityRedactionEvent) {
    // An event of an older server key cannot be replayed with this key; it is
    // reported, never silently skipped.
    if (event.replay.keyVersion !== SECURITY_REDACTION_REPLAY_KEY_VERSION) {
      return "staleKey" as const;
    }
    const target = parseSecurityRedactionScopeAlias(event.scopeAlias);
    if (!target) {
      return "unreadable" as const;
    }
    for (const text of await texts(target)) {
      const value = findReplayValue(key, event.replay, text);
      if (value !== null) {
        // biome-ignore lint/performance/noAwaitInLoops: Returns right after the one removal.
        await spread.spread({ ...target, sensitiveValue: value });
        return "reapplied" as const;
      }
    }
    return "clean" as const;
  }

  return {
    async replay() {
      const result: SecurityRedactionReplayResult = {
        reapplied: 0,
        staleKey: 0,
        unreadable: 0,
      };
      const { events, unreadable } = await options.events.list();
      result.unreadable += unreadable;
      for (const event of events) {
        // biome-ignore lint/performance/noAwaitInLoops: One event at a time keeps each removal ordered and bounded.
        const outcome = await reapply(event);
        if (outcome === "reapplied") {
          result.reapplied += 1;
        } else if (outcome === "staleKey") {
          result.staleKey += 1;
        } else if (outcome === "unreadable") {
          result.unreadable += 1;
        }
      }
      return result;
    },
  };
}
