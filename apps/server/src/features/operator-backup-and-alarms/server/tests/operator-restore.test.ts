import { describe, expect, test } from "vitest";

import {
  createBackupSealer,
  createEphemeralBackupKeyRing,
  rotateBackupKeyRing,
} from "../backup-envelope";
import { createOperatorBackup } from "../operator-backup";
import {
  createOperatorRestore,
  RESTORE_RTO_TARGET_MS,
} from "../operator-restore";
import {
  assertLogOutsidePrimary,
  createGuardedSecurityLog,
  SecurityLogGuardError,
} from "../security-event-log";
import { createBackupWorld, objectRef } from "./operator-backup-memory";
import {
  createRestoreWorld,
  LOG_PLACEMENT,
  logEvent,
  PRIMARY_PLACEMENT,
  type RestoreWorld,
} from "./operator-restore-memory";

const HOUR = 60 * 60 * 1000;

function setup() {
  const backupWorld = createBackupWorld();
  const world = createRestoreWorld(backupWorld);
  const ring = createEphemeralBackupKeyRing();
  const sealer = createBackupSealer(ring);
  const backup = createOperatorBackup({
    database: world.database,
    newUnitId: backupWorld.newUnitId,
    now: backupWorld.now,
    objects: backupWorld.objectStore,
    sealer,
    store: backupWorld.store,
  });
  const restoreWith = (
    overrides: Partial<Parameters<typeof createOperatorRestore>[0]> = {},
  ) =>
    createOperatorRestore({
      backup,
      backupStore: backupWorld.store,
      evidence: world.store,
      gate: world.controller,
      log: world.log,
      now: backupWorld.now,
      primary: world.primary,
      primaryPlacement: PRIMARY_PLACEMENT,
      target: world.target,
      ...overrides,
    });
  return { backup, backupWorld, restoreWith, ring, world };
}

/** Old backup, then newer revoke / redact / delete / surface events in the log. */
async function seedOlderBackupWithNewerEvents(
  s: ReturnType<typeof setup>,
  gateProbe?: (world: RestoreWorld) => void,
) {
  const { backup, backupWorld, world } = s;
  backupWorld.addAttachment(objectRef("a/deleted"));
  backupWorld.addAttachment(objectRef("b/redacted"));
  backupWorld.addAttachment(objectRef("c/kept"));
  world.openSession("visitor-1");
  world.openSurface("surface-1");
  const unit = await backup.run();
  if (unit.status !== "verified") {
    throw new Error("The seeded backup did not verify.");
  }
  backupWorld.advance(30 * 60 * 1000);
  const at = backupWorld.now();
  await world.log.append(logEvent("session.revoked", "visitor-1", at));
  await world.log.append(
    logEvent("trash.permanently-deleted", "a/deleted", at),
  );
  await world.log.append(
    logEvent("security-redaction.applied", "b/redacted", at),
  );
  await world.log.append(
    logEvent("link-sharing.surface-revoked", "surface-1", at),
  );
  gateProbe?.(world);
}

describe("Operator Backup and Alarms: restore drill", () => {
  test("keeps access closed, replays to the frontier, still denies the revoked, redacted and deleted, then opens", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    // The disaster: live state is lost; the restore starts from the old backup.
    const seenDuringRestore: boolean[] = [];
    const target = {
      ...s.world.target,
      apply: async (effect: Parameters<typeof s.world.target.apply>[0]) => {
        seenDuringRestore.push(s.world.gate.allows("external-surface"));
        await s.world.target.apply(effect);
      },
    };

    const result = await s.restoreWith({ target }).run();

    expect(result.status).toBe("restored");
    expect(seenDuringRestore).toEqual([false, false, false, false]);
    expect(s.world.gate.status()).toEqual({
      open: true,
      reason: "restore-verified",
    });
    // The restored backup alone would have served all four; the log denies them.
    expect(s.world.canServe("visitor-session", "visitor-1")).toBe(false);
    expect(s.world.canServe("external-surface", "surface-1")).toBe(false);
    expect(s.world.canServe("origin-asset", "a/deleted")).toBe(false);
    expect(s.world.canServe("origin-asset", "b/redacted")).toBe(false);
    expect(s.world.canServe("origin-asset", "c/kept")).toBe(true);
    if (result.status === "restored") {
      expect(result.evidence.replayedEvents).toBe(4);
      expect(result.evidence.replayFrontier).toBe("4");
      expect(result.evidence.effects).toEqual({
        "close-surface": 1,
        "redact-record": 1,
        "remove-record": 1,
        "revoke-session": 1,
      });
    }
    expect(s.world.evidence).toHaveLength(1);
  });

  test("access is closed before the restore touches anything and stays closed on a replay error", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    s.world.controller.open("normal-operation");
    s.world.faults.applyFails = true;

    const result = await s.restoreWith().run();

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.failure.code).toBe(
      "REPLAY_FAILED",
    );
    for (const kind of [
      "external-surface",
      "visitor-session",
      "origin-asset",
    ] as const) {
      expect(s.world.gate.allows(kind)).toBe(false);
    }
    expect(s.world.failures).toHaveLength(1);
    expect(s.world.evidence).toHaveLength(0);
  });

  test("an unreachable log keeps access closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    s.world.faults.logUnreachable = true;

    const result = await s.restoreWith().run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "LOG_UNAVAILABLE",
    );
    expect(s.world.gate.allows("origin-asset")).toBe(false);
  });

  test("a replay rule that does not actually deny keeps access closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    s.world.faults.skipKinds.add("revoke-session");

    const result = await s.restoreWith().run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "DENIAL_NOT_ENFORCED",
    );
    expect(result.status === "failed" && result.failure.details).toEqual([
      "revoke-session:visitor-1",
    ]);
    expect(s.world.gate.allows("visitor-session")).toBe(false);
  });

  test("an event type without a restore rule fails closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    await s.world.log.append(
      logEvent("brand-new.irreversible", "x", s.backupWorld.now()),
    );

    const result = await s.restoreWith().run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "UNREGISTERED_EVENT_TYPE",
    );
    expect(s.world.gate.allows("external-surface")).toBe(false);
  });

  test("an object manifest that disagrees with the restored rows keeps access closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const primary = {
      ...s.world.primary,
      storedObjects: () =>
        Promise.resolve([objectRef("c/kept"), objectRef("z/stray")]),
    };

    const result = await s.restoreWith({ primary }).run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "INTEGRITY_FAILED",
    );
    expect(s.world.gate.allows("origin-asset")).toBe(false);
  });

  test("a run without a verified unit fails closed", async () => {
    const s = setup();
    const result = await s.restoreWith().run();
    expect(result.status === "failed" && result.failure.code).toBe(
      "NO_VERIFIED_UNIT",
    );
    expect(s.world.gate.allows("external-surface")).toBe(false);
  });

  test("an integrity probe outage is its own failure code and keeps access closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const primary = {
      ...s.world.primary,
      rowObjectRefs: () => Promise.reject(new Error("probe down")),
    };

    const result = await s.restoreWith({ primary }).run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "INTEGRITY_CHECK_UNAVAILABLE",
    );
    expect(s.world.gate.allows("origin-asset")).toBe(false);
  });

  test("a denial probe outage is its own failure code and keeps access closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const target = {
      ...s.world.target,
      isDenied: () => Promise.reject(new Error("probe down")),
    };

    const result = await s.restoreWith({ target }).run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "DENIAL_PROOF_UNAVAILABLE",
    );
    expect(result.status === "failed" && result.failure.details).toEqual([
      "visitor-1",
    ]);
    expect(s.world.gate.allows("visitor-session")).toBe(false);
  });
});

describe("Operator Backup and Alarms: restore key and ciphertext", () => {
  test("restore reads with the stored key version and never rewrites the ciphertext", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const sealedBefore = JSON.stringify(
      s.backupWorld.verified[0]?.sealed ?? null,
    );

    const result = await s.restoreWith().run();

    expect(result.status).toBe("restored");
    expect(JSON.stringify(s.backupWorld.verified[0]?.sealed)).toBe(
      sealedBefore,
    );
    expect(result.status === "restored" && result.evidence.keyVersion).toBe(
      s.backupWorld.verified[0]?.sealed.keyVersion,
    );
  });

  test("after a key rotation the old unit still opens by its own version, unchanged", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const oldVersion = s.backupWorld.verified[0]?.sealed.keyVersion;
    const rotated = rotateBackupKeyRing(s.ring);
    const rotatedBackup = createOperatorBackup({
      database: s.world.database,
      newUnitId: s.backupWorld.newUnitId,
      now: s.backupWorld.now,
      objects: s.backupWorld.objectStore,
      sealer: createBackupSealer(rotated),
      store: s.backupWorld.store,
    });

    const result = await s.restoreWith({ backup: rotatedBackup }).run();

    expect(result.status).toBe("restored");
    expect(result.status === "restored" && result.evidence.keyVersion).toBe(
      oldVersion,
    );
    expect(rotated.currentVersion).not.toBe(oldVersion);
  });

  test("a key ring without the stored version cannot open the unit and access stays closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const otherBackup = createOperatorBackup({
      database: s.world.database,
      newUnitId: s.backupWorld.newUnitId,
      now: s.backupWorld.now,
      objects: s.backupWorld.objectStore,
      sealer: createBackupSealer(createEphemeralBackupKeyRing()),
      store: s.backupWorld.store,
    });

    const result = await s.restoreWith({ backup: otherBackup }).run();

    expect(result.status === "failed" && result.failure.code).toBe(
      "MANIFEST_UNREADABLE",
    );
    expect(s.world.gate.allows("origin-asset")).toBe(false);
  });
});

describe("Operator Backup and Alarms: RTO", () => {
  test("is measured in the same drill and is within eight hours", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    s.world.durations.primaryMs = 3 * HOUR;

    const result = await s.restoreWith().run();

    expect(result.status).toBe("restored");
    if (result.status === "restored") {
      expect(result.evidence.rtoMs).toBe(3 * HOUR + 4 * 1000);
      expect(result.evidence.rtoWithinTarget).toBe(true);
    }
    expect(RESTORE_RTO_TARGET_MS).toBe(8 * HOUR);
  });

  test("a restore slower than eight hours is reported as outside the target", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    s.world.durations.primaryMs = 9 * HOUR;

    const result = await s.restoreWith().run();

    expect(
      result.status === "restored" && result.evidence.rtoWithinTarget,
    ).toBe(false);
  });
});

describe("Operator Backup and Alarms: log outside the primary restore unit", () => {
  test("restoring the primary does not roll the log back", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const before = JSON.stringify(s.world.logEvents);

    await s.restoreWith().run();

    expect(JSON.stringify(s.world.logEvents)).toBe(before);
    expect(s.world.logEvents).toHaveLength(4);
  });

  test("a log that shares the primary project or credentials is refused", () => {
    expect(() =>
      assertLogOutsidePrimary(PRIMARY_PLACEMENT, {
        ...LOG_PLACEMENT,
        projectId: PRIMARY_PLACEMENT.projectId,
      }),
    ).toThrow(SecurityLogGuardError);
    expect(() =>
      assertLogOutsidePrimary(PRIMARY_PLACEMENT, {
        ...LOG_PLACEMENT,
        credentialId: PRIMARY_PLACEMENT.credentialId,
      }),
    ).toThrow(SecurityLogGuardError);
  });

  test("a log outside the EU region is refused", () => {
    expect(() =>
      assertLogOutsidePrimary(PRIMARY_PLACEMENT, {
        ...LOG_PLACEMENT,
        region: "us",
      }),
    ).toThrow(expect.objectContaining({ code: "LOG_NOT_EU" }));
  });

  test("a restore against a co-located log fails closed", async () => {
    const s = setup();
    await seedOlderBackupWithNewerEvents(s);
    const result = await s
      .restoreWith({
        primaryPlacement: { ...PRIMARY_PLACEMENT, projectId: "log-project" },
      })
      .run();
    expect(result.status === "failed" && result.failure.code).toBe(
      "LOG_NOT_SEPARATE",
    );
    expect(s.world.gate.allows("external-surface")).toBe(false);
  });

  test("the guarded log accepts an aliased registered event", async () => {
    const s = setup();
    const log = s.world.guardedLog();
    await log.append(
      logEvent("session.revoked", "session-alias-1", s.backupWorld.now()),
    );
    expect(s.world.logEvents).toHaveLength(1);
  });

  test.each([
    [
      "a secret-bearing field",
      { token: "tok_live_abc" },
      "LOG_EVENT_HAS_CONTENT",
    ],
    ["user content", { body: "private note" }, "LOG_EVENT_HAS_CONTENT"],
    [
      "a long opaque secret as the target",
      { targetAlias: "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2" },
      "LOG_EVENT_HAS_CONTENT",
    ],
    [
      "a URL as the target",
      { targetAlias: "https://x.example/s/secret" },
      "LOG_EVENT_HAS_CONTENT",
    ],
    [
      "an email as the actor",
      { actorAlias: "founder@example.com" },
      "LOG_EVENT_NOT_ALIASED",
    ],
    [
      "an unregistered type",
      { type: "brand-new.irreversible" },
      "LOG_EVENT_UNREGISTERED",
    ],
  ])("rejects an event carrying %s", async (_name, patch, code) => {
    const s = setup();
    const log = createGuardedSecurityLog(s.world.log, PRIMARY_PLACEMENT);
    const event = {
      ...logEvent("session.revoked", "session-alias-1", s.backupWorld.now()),
      ...patch,
    };
    await expect(log.append(event)).rejects.toMatchObject({ code });
    expect(s.world.logEvents).toHaveLength(0);
  });
});
