import type {
  AccountSessionAccess,
  AccountSessionPrincipal,
} from "@cantiara/api/context";
import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_IDLE_LIFETIME_MS,
} from "@cantiara/auth";

export interface ProductSession {
  accountId: string;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  lastActivityAt: Date;
  userAgent: string | null;
}

export type SessionPrincipal = AccountSessionPrincipal;

export interface SessionStore {
  find: (sessionId: string) => Promise<ProductSession | null>;
  list: (accountId: string) => Promise<ProductSession[]>;
  revoke: (accountId: string, sessionId: string) => Promise<void>;
  touch: (
    accountId: string,
    sessionId: string,
    lastActivityAt: Date,
  ) => Promise<void>;
}

export interface AuditRecordStore {
  append: (record: SessionRevocationAuditRecord) => Promise<void>;
  pruneBefore: (cutoff: Date) => Promise<void>;
}

export interface SessionRevokedSecurityEvent {
  actorAlias: string;
  id: string;
  occurredAt: string;
  targetSessionAlias: string;
  type: "session.revoked";
  version: 1;
}

export type SessionRevocationAuditRecord = Omit<
  SessionRevokedSecurityEvent,
  "version"
>;

export interface SecurityEventLog {
  appendMany: (events: SessionRevokedSecurityEvent[]) => Promise<void>;
  isSessionRevoked: (targetSessionAlias: string) => Promise<boolean>;
  listSessionRevocations: () => Promise<SessionRevokedSecurityEvent[]>;
}

export interface AccountSessionAccessRuntime extends AccountSessionAccess {
  authorizeWrite: (principal: SessionPrincipal) => Promise<boolean>;
  replaySessionRevocations: () => Promise<void>;
}

export const ACCOUNT_ACCESS_AUDIT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

const rawUserAgentPattern =
  /Mozilla\/|AppleWebKit\/|Gecko\/|Chrome\/|CriOS\/|Firefox\/|FxiOS\/|Safari\/|Edg(?:A|iOS)?\/|OPR\//;
const edgePattern = /Edg(?:A|iOS)?\//;
const operaPattern = /OPR\//;
const firefoxPattern = /(?:Firefox|FxiOS)\//;
const chromePattern = /(?:Chrome|CriOS)\//;
const safariPattern = /Safari\//;
const iPhonePattern = /iPhone/;
const iPadPattern = /iPad/;
const androidPattern = /Android/;
const windowsPattern = /Windows/;
const macintoshPattern = /Macintosh/;
const chromeOsPattern = /CrOS/;
const linuxPattern = /Linux/;

function describeSessionDevice(userAgent: string | null) {
  const value = userAgent?.trim();
  if (!value) {
    return "Unknown device";
  }

  if (!rawUserAgentPattern.test(value)) {
    return "Unknown device";
  }

  let browser: string | undefined;
  if (edgePattern.test(value)) {
    browser = "Edge";
  } else if (operaPattern.test(value)) {
    browser = "Opera";
  } else if (firefoxPattern.test(value)) {
    browser = "Firefox";
  } else if (chromePattern.test(value)) {
    browser = "Chrome";
  } else if (safariPattern.test(value)) {
    browser = "Safari";
  }

  let platform: string | undefined;
  if (iPhonePattern.test(value)) {
    platform = "iPhone";
  } else if (iPadPattern.test(value)) {
    platform = "iPad";
  } else if (androidPattern.test(value)) {
    platform = "Android";
  } else if (windowsPattern.test(value)) {
    platform = "Windows";
  } else if (macintoshPattern.test(value)) {
    platform = "macOS";
  } else if (chromeOsPattern.test(value)) {
    platform = "ChromeOS";
  } else if (linuxPattern.test(value)) {
    platform = "Linux";
  }

  if (browser && platform) {
    return `${browser} on ${platform}`;
  }
  return browser ?? platform ?? "Unknown device";
}

function isWithinSessionLifetime(session: ProductSession, now: Date) {
  const nowMs = now.getTime();
  return (
    session.expiresAt.getTime() > nowMs &&
    session.lastActivityAt.getTime() + SESSION_IDLE_LIFETIME_MS > nowMs &&
    session.createdAt.getTime() + SESSION_ABSOLUTE_LIFETIME_MS > nowMs
  );
}

function createRevocationEvent(
  principal: SessionPrincipal,
  targetSessionAlias: string,
  occurredAt: string,
): SessionRevokedSecurityEvent {
  return {
    actorAlias: principal.sessionId,
    id: crypto.randomUUID(),
    occurredAt,
    targetSessionAlias,
    type: "session.revoked",
    version: 1,
  };
}

export function createAccountSessionAccess({
  auditRecords,
  now,
  securityEvents,
  sessions,
}: {
  auditRecords: AuditRecordStore;
  now?: () => Date;
  securityEvents: SecurityEventLog;
  sessions: SessionStore;
}): AccountSessionAccessRuntime {
  const currentTime = now ?? (() => new Date());

  async function authorizeWrite(principal: SessionPrincipal) {
    try {
      const at = currentTime();
      const [productSession, sessionRevoked] = await Promise.all([
        sessions.find(principal.sessionId),
        securityEvents.isSessionRevoked(principal.sessionId),
      ]);
      const authorized = Boolean(
        productSession &&
          productSession.accountId === principal.accountId &&
          isWithinSessionLifetime(productSession, at) &&
          !sessionRevoked,
      );
      if (authorized) {
        await sessions.touch(principal.accountId, principal.sessionId, at);
      }
      return authorized;
    } catch {
      return false;
    }
  }

  async function revokeTarget(
    principal: SessionPrincipal,
    targetSessionAlias: string,
  ) {
    if (!(await authorizeWrite(principal))) {
      return;
    }

    const target = await sessions.find(targetSessionAlias);
    if (!(target && target.accountId === principal.accountId)) {
      return;
    }

    const occurredAt = currentTime().toISOString();
    const event = createRevocationEvent(
      principal,
      targetSessionAlias,
      occurredAt,
    );

    await securityEvents.appendMany([event]);
    await auditRecords.append({
      actorAlias: event.actorAlias,
      id: event.id,
      occurredAt,
      targetSessionAlias,
      type: event.type,
    });
    await sessions.revoke(principal.accountId, targetSessionAlias);
  }

  return {
    authorizeWrite,
    async listSessions(principal: SessionPrincipal) {
      const at = currentTime();
      const [accountSessions, revocations] = await Promise.all([
        sessions.list(principal.accountId),
        securityEvents.listSessionRevocations(),
      ]);
      const revokedAliases = new Set(
        revocations.map((event) => event.targetSessionAlias),
      );
      return accountSessions
        .filter(
          (item) =>
            isWithinSessionLifetime(item, at) && !revokedAliases.has(item.id),
        )
        .map((item) => ({
          current: item.id === principal.sessionId,
          device: describeSessionDevice(item.userAgent),
          id: item.id,
          lastActivityAt: item.lastActivityAt.toISOString(),
        }));
    },
    async replaySessionRevocations() {
      const revocations = await securityEvents.listSessionRevocations();
      const auditCutoff = new Date(
        currentTime().getTime() - ACCOUNT_ACCESS_AUDIT_RETENTION_MS,
      );
      await auditRecords.pruneBefore(auditCutoff);
      await Promise.all(
        revocations.map(async (event) => {
          if (new Date(event.occurredAt) >= auditCutoff) {
            await auditRecords.append({
              actorAlias: event.actorAlias,
              id: event.id,
              occurredAt: event.occurredAt,
              targetSessionAlias: event.targetSessionAlias,
              type: event.type,
            });
          }
          const restoredSession = await sessions.find(event.targetSessionAlias);
          if (restoredSession) {
            await sessions.revoke(
              restoredSession.accountId,
              event.targetSessionAlias,
            );
          }
        }),
      );
    },
    async revokeSession(
      principal: SessionPrincipal,
      targetSessionAlias: string,
    ) {
      await revokeTarget(principal, targetSessionAlias);
    },
    async revokeOtherSessions(principal: SessionPrincipal) {
      if (!(await authorizeWrite(principal))) {
        return;
      }

      const otherSessions = (await sessions.list(principal.accountId)).filter(
        (item) => item.id !== principal.sessionId,
      );
      if (otherSessions.length === 0) {
        return;
      }

      const occurredAt = currentTime().toISOString();
      const events = otherSessions.map((otherSession) =>
        createRevocationEvent(principal, otherSession.id, occurredAt),
      );
      await securityEvents.appendMany(events);
      await Promise.all(
        events.map((event) =>
          auditRecords.append({
            actorAlias: event.actorAlias,
            id: event.id,
            occurredAt: event.occurredAt,
            targetSessionAlias: event.targetSessionAlias,
            type: event.type,
          }),
        ),
      );
      await Promise.all(
        otherSessions.map((otherSession) =>
          sessions.revoke(principal.accountId, otherSession.id),
        ),
      );
    },
  };
}
