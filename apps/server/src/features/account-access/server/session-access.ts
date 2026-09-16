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
  append: (event: SessionRevokedSecurityEvent) => Promise<void>;
  listSessionRevocations: () => Promise<SessionRevokedSecurityEvent[]>;
}

export interface AccountSessionAccessRuntime extends AccountSessionAccess {
  authorizeWrite: (principal: SessionPrincipal) => Promise<boolean>;
  replaySessionRevocations: () => Promise<void>;
}

export const ACCOUNT_ACCESS_AUDIT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

function isWithinSessionLifetime(session: ProductSession, now: Date) {
  const nowMs = now.getTime();
  return (
    session.expiresAt.getTime() > nowMs &&
    session.lastActivityAt.getTime() + SESSION_IDLE_LIFETIME_MS > nowMs &&
    session.createdAt.getTime() + SESSION_ABSOLUTE_LIFETIME_MS > nowMs
  );
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

  async function revokeTarget(
    principal: SessionPrincipal,
    targetSessionAlias: string,
  ) {
    const target = await sessions.find(targetSessionAlias);
    if (!(target && target.accountId === principal.accountId)) {
      return;
    }

    const occurredAt = currentTime().toISOString();
    const event: SessionRevokedSecurityEvent = {
      actorAlias: principal.sessionId,
      id: crypto.randomUUID(),
      occurredAt,
      targetSessionAlias,
      type: "session.revoked",
      version: 1,
    };

    await securityEvents.append(event);
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
    async authorizeWrite(principal: SessionPrincipal) {
      try {
        const at = currentTime();
        const [productSession, revocations] = await Promise.all([
          sessions.find(principal.sessionId),
          securityEvents.listSessionRevocations(),
        ]);
        const authorized = Boolean(
          productSession &&
            productSession.accountId === principal.accountId &&
            isWithinSessionLifetime(productSession, at) &&
            !revocations.some(
              (event) =>
                event.targetSessionAlias === principal.sessionId &&
                event.type === "session.revoked",
            ),
        );
        if (authorized) {
          await sessions.touch(principal.accountId, principal.sessionId, at);
        }
        return authorized;
      } catch {
        return false;
      }
    },
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
          device: item.userAgent ?? "Unknown device",
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
      const otherSessions = (await sessions.list(principal.accountId)).filter(
        (item) => item.id !== principal.sessionId,
      );
      await Promise.all(
        otherSessions.map((otherSession) =>
          revokeTarget(principal, otherSession.id),
        ),
      );
    },
  };
}
