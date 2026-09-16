import { describe, expect, test } from "vitest";

import {
  createAccountSessionAccess,
  type ProductSession,
  type SessionRevocationAuditRecord,
  type SessionRevokedSecurityEvent,
} from "./session-access";

const NOW = new Date("2026-09-16T09:00:00.000Z");

function session(
  overrides: Partial<ProductSession> & Pick<ProductSession, "id">,
): ProductSession {
  return {
    accountId: "account-1",
    createdAt: new Date("2026-09-15T09:00:00.000Z"),
    expiresAt: new Date("2026-10-15T09:00:00.000Z"),
    lastActivityAt: new Date("2026-09-16T08:45:00.000Z"),
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
    ...overrides,
    id: overrides.id,
  };
}

describe("Account Access sessions", () => {
  test("lists active sessions by device and last activity without exposing tokens", async () => {
    const currentSession = session({ id: "current-session" });
    const otherSession = session({
      id: "other-session",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
    });
    const sessions = [currentSession, otherSession];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: async () => undefined,
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: async () => undefined,
        listSessionRevocations: async () => [],
      },
      sessions: {
        find: async (id) => sessions.find((item) => item.id === id) ?? null,
        list: async () => sessions,
        revoke: async () => undefined,
        touch: async () => undefined,
      },
    });

    const result = await access.listSessions({
      accountId: "account-1",
      sessionId: "current-session",
    });

    expect(result).toEqual([
      {
        current: true,
        device: currentSession.userAgent,
        id: "current-session",
        lastActivityAt: "2026-09-16T08:45:00.000Z",
      },
      {
        current: false,
        device: otherSession.userAgent,
        id: "other-session",
        lastActivityAt: "2026-09-16T08:45:00.000Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("token");
  });

  test("revokes one session fail-closed while the current session can still write", async () => {
    const storedSessions = [
      session({ id: "current-session" }),
      session({ id: "other-session" }),
    ];
    const auditRecords: SessionRevocationAuditRecord[] = [];
    const securityEvents: SessionRevokedSecurityEvent[] = [];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: (record) => {
          auditRecords.push(record);
          return Promise.resolve();
        },
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: (event) => {
          securityEvents.push(event);
          return Promise.resolve();
        },
        listSessionRevocations: async () => securityEvents,
      },
      sessions: {
        find: async (id) =>
          storedSessions.find((item) => item.id === id) ?? null,
        list: async () => storedSessions,
        revoke: (accountId, id) => {
          const index = storedSessions.findIndex(
            (item) => item.accountId === accountId && item.id === id,
          );
          if (index >= 0) {
            storedSessions.splice(index, 1);
          }
          return Promise.resolve();
        },
        touch: async () => undefined,
      },
    });
    const principal = {
      accountId: "account-1",
      sessionId: "current-session",
    };

    await access.revokeSession(principal, "other-session");

    expect(securityEvents).toEqual([
      {
        actorAlias: "current-session",
        id: expect.any(String),
        occurredAt: "2026-09-16T09:00:00.000Z",
        targetSessionAlias: "other-session",
        type: "session.revoked",
        version: 1,
      },
    ]);
    expect(auditRecords).toEqual([
      {
        actorAlias: "current-session",
        id: expect.any(String),
        occurredAt: "2026-09-16T09:00:00.000Z",
        targetSessionAlias: "other-session",
        type: "session.revoked",
      },
    ]);
    await expect(
      access.authorizeWrite({
        accountId: "account-1",
        sessionId: "other-session",
      }),
    ).resolves.toBe(false);
    await expect(access.authorizeWrite(principal)).resolves.toBe(true);
  });

  test("revokes every other session and keeps the current session", async () => {
    const storedSessions = [
      session({ id: "current-session" }),
      session({ id: "phone-session" }),
      session({ id: "desktop-session" }),
    ];
    const securityEvents: SessionRevokedSecurityEvent[] = [];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: async () => undefined,
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: (event) => {
          securityEvents.push(event);
          return Promise.resolve();
        },
        listSessionRevocations: async () => securityEvents,
      },
      sessions: {
        find: async (id) =>
          storedSessions.find((item) => item.id === id) ?? null,
        list: async () => storedSessions,
        revoke: (accountId, id) => {
          const index = storedSessions.findIndex(
            (item) => item.accountId === accountId && item.id === id,
          );
          if (index >= 0) {
            storedSessions.splice(index, 1);
          }
          return Promise.resolve();
        },
        touch: async () => undefined,
      },
    });
    const principal = {
      accountId: "account-1",
      sessionId: "current-session",
    };

    await access.revokeOtherSessions(principal);

    expect(securityEvents.map((event) => event.targetSessionAlias)).toEqual([
      "phone-session",
      "desktop-session",
    ]);
    await expect(access.listSessions(principal)).resolves.toEqual([
      expect.objectContaining({ current: true, id: "current-session" }),
    ]);
    await expect(access.authorizeWrite(principal)).resolves.toBe(true);
  });

  test("denies a revoked session when primary-row deletion fails", async () => {
    const storedSession = session({ id: "other-session" });
    const securityEvents: SessionRevokedSecurityEvent[] = [];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: async () => undefined,
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: (event) => {
          securityEvents.push(event);
          return Promise.resolve();
        },
        listSessionRevocations: async () => securityEvents,
      },
      sessions: {
        find: async () => storedSession,
        list: async () => [storedSession],
        revoke: () => Promise.reject(new Error("primary database unavailable")),
        touch: async () => undefined,
      },
    });

    await expect(
      access.revokeSession(
        { accountId: "account-1", sessionId: "current-session" },
        "other-session",
      ),
    ).rejects.toThrow("primary database unavailable");
    await expect(
      access.authorizeWrite({
        accountId: "account-1",
        sessionId: "other-session",
      }),
    ).resolves.toBe(false);
  });

  test("replay restores a missing audit record before revoking the restored row", async () => {
    const storedSessions = [session({ id: "other-session" })];
    const securityEvents: SessionRevokedSecurityEvent[] = [];
    const auditRecords: SessionRevocationAuditRecord[] = [];
    const unavailableAuditStores = new Set(["primary"]);
    const access = createAccountSessionAccess({
      auditRecords: {
        append: (record) => {
          if (unavailableAuditStores.has("primary")) {
            return Promise.reject(new Error("audit database unavailable"));
          }
          if (!auditRecords.some((item) => item.id === record.id)) {
            auditRecords.push(record);
          }
          return Promise.resolve();
        },
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: (event) => {
          securityEvents.push(event);
          return Promise.resolve();
        },
        listSessionRevocations: async () => securityEvents,
      },
      sessions: {
        find: async (id) =>
          storedSessions.find((item) => item.id === id) ?? null,
        list: async () => storedSessions,
        revoke: (_accountId, id) => {
          const index = storedSessions.findIndex((item) => item.id === id);
          if (index >= 0) {
            storedSessions.splice(index, 1);
          }
          return Promise.resolve();
        },
        touch: async () => undefined,
      },
    });

    await expect(
      access.revokeSession(
        { accountId: "account-1", sessionId: "current-session" },
        "other-session",
      ),
    ).rejects.toThrow("audit database unavailable");
    expect(storedSessions).toHaveLength(1);

    unavailableAuditStores.clear();
    await access.replaySessionRevocations();

    expect(auditRecords).toEqual([
      expect.objectContaining({
        id: securityEvents[0]?.id,
        targetSessionAlias: "other-session",
        type: "session.revoked",
      }),
    ]);
    expect(storedSessions).toEqual([]);
  });

  test("replays revoke after a restore resurrects a still-live session row", async () => {
    const restoredSessions = [session({ id: "restored-session" })];
    const securityEvents: SessionRevokedSecurityEvent[] = [
      {
        actorAlias: "actor-session",
        id: "security-event-1",
        occurredAt: "2026-09-16T08:00:00.000Z",
        targetSessionAlias: "restored-session",
        type: "session.revoked",
        version: 1,
      },
    ];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: async () => undefined,
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: (event) => {
          securityEvents.push(event);
          return Promise.resolve();
        },
        listSessionRevocations: async () => securityEvents,
      },
      sessions: {
        find: async (id) =>
          restoredSessions.find((item) => item.id === id) ?? null,
        list: async () => restoredSessions,
        revoke: (accountId, id) => {
          const index = restoredSessions.findIndex(
            (item) => item.accountId === accountId && item.id === id,
          );
          if (index >= 0) {
            restoredSessions.splice(index, 1);
          }
          return Promise.resolve();
        },
        touch: async () => undefined,
      },
    });

    await access.replaySessionRevocations();

    await expect(
      access.authorizeWrite({
        accountId: "account-1",
        sessionId: "restored-session",
      }),
    ).resolves.toBe(false);
    expect(restoredSessions).toEqual([]);
  });

  test("keeps audit replay inside the 365-day retention window", async () => {
    const auditRecords: SessionRevocationAuditRecord[] = [
      {
        actorAlias: "old-actor",
        id: "expired-audit",
        occurredAt: "2025-09-15T08:59:59.000Z",
        targetSessionAlias: "old-session",
        type: "session.revoked",
      },
    ];
    const restoredSessions = [
      session({ id: "old-session" }),
      session({ id: "recent-session" }),
    ];
    const securityEvents: SessionRevokedSecurityEvent[] = [
      {
        actorAlias: "old-actor",
        id: "old-event",
        occurredAt: "2025-09-15T08:59:59.000Z",
        targetSessionAlias: "old-session",
        type: "session.revoked",
        version: 1,
      },
      {
        actorAlias: "recent-actor",
        id: "recent-event",
        occurredAt: "2026-09-16T08:00:00.000Z",
        targetSessionAlias: "recent-session",
        type: "session.revoked",
        version: 1,
      },
    ];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: (record) => {
          auditRecords.push(record);
          return Promise.resolve();
        },
        pruneBefore: (cutoff) => {
          const retained = auditRecords.filter(
            (record) => new Date(record.occurredAt) >= cutoff,
          );
          auditRecords.splice(0, auditRecords.length, ...retained);
          return Promise.resolve();
        },
      },
      now: () => NOW,
      securityEvents: {
        append: async () => undefined,
        listSessionRevocations: async () => securityEvents,
      },
      sessions: {
        find: async (id) =>
          restoredSessions.find((item) => item.id === id) ?? null,
        list: async () => restoredSessions,
        revoke: (_accountId, id) => {
          const index = restoredSessions.findIndex((item) => item.id === id);
          if (index >= 0) {
            restoredSessions.splice(index, 1);
          }
          return Promise.resolve();
        },
        touch: async () => undefined,
      },
    });

    await access.replaySessionRevocations();

    expect(auditRecords).toEqual([
      expect.objectContaining({ id: "recent-event" }),
    ]);
    expect(restoredSessions).toEqual([]);
  });

  test("ends sessions after 12 hours idle or 30 days from creation", async () => {
    const touchedSessions: string[] = [];
    const storedSessions = [
      session({
        id: "valid-session",
        lastActivityAt: new Date("2026-09-15T21:00:01.000Z"),
      }),
      session({
        id: "idle-session",
        lastActivityAt: new Date("2026-09-15T21:00:00.000Z"),
      }),
      session({
        createdAt: new Date("2026-08-17T09:00:00.000Z"),
        id: "absolute-session",
      }),
    ];
    const access = createAccountSessionAccess({
      auditRecords: {
        append: async () => undefined,
        pruneBefore: async () => undefined,
      },
      now: () => NOW,
      securityEvents: {
        append: async () => undefined,
        listSessionRevocations: async () => [],
      },
      sessions: {
        find: async (id) =>
          storedSessions.find((item) => item.id === id) ?? null,
        list: async () => storedSessions,
        revoke: async () => undefined,
        touch: (_accountId, sessionId) => {
          touchedSessions.push(sessionId);
          return Promise.resolve();
        },
      },
    });

    await expect(
      access.authorizeWrite({
        accountId: "account-1",
        sessionId: "valid-session",
      }),
    ).resolves.toBe(true);
    await expect(
      access.authorizeWrite({
        accountId: "account-1",
        sessionId: "idle-session",
      }),
    ).resolves.toBe(false);
    await expect(
      access.authorizeWrite({
        accountId: "account-1",
        sessionId: "absolute-session",
      }),
    ).resolves.toBe(false);
    expect(touchedSessions).toEqual(["valid-session"]);
  });
});
