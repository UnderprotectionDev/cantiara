import { describe, expect, test } from "vitest";

import {
  createBackupSealer,
  createEphemeralBackupKeyRing,
} from "../backup-envelope";
import {
  assertCadenceMeetsRpo,
  assertIsBackupUnitKind,
  BACKUP_RPO_TARGET_MS,
  createOperatorBackup,
  OperatorBackupError,
  runRpoDrill,
} from "../operator-backup";
import {
  type BackupWorld,
  createBackupWorld,
  objectRef,
} from "./operator-backup-memory";

function setup(world: BackupWorld = createBackupWorld()) {
  const sealer = createBackupSealer(createEphemeralBackupKeyRing());
  const backup = createOperatorBackup({
    database: world.database,
    newUnitId: world.newUnitId,
    now: world.now,
    objects: world.objectStore,
    sealer,
    store: world.store,
  });
  return { backup, sealer, world };
}

describe("Operator Backup and Alarms: backup unit", () => {
  test("records the database point and the object manifest as one verified unit", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    world.addAttachment(objectRef("b/two", 20));

    const result = await backup.run();

    expect(result.status).toBe("verified");
    expect(world.verified).toHaveLength(1);
    expect(world.failures).toHaveLength(0);
    if (result.status === "verified") {
      const manifest = backup.openManifest(result.unit);
      expect(manifest.snapshotId).toBe(result.unit.snapshotId);
      expect(manifest.pointAt).toBe(result.unit.pointAt);
      expect(manifest.objects.map((object) => object.key)).toEqual([
        "a/one",
        "b/two",
      ]);
      expect(result.unit.objectCount).toBe(2);
      expect(JSON.stringify(result.unit)).not.toContain("a/one");
    }
  });

  test("a database row without its original object is not a success", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    world.addRowOnly(objectRef("c/lost"));

    const result = await backup.run();

    expect(result.status).toBe("failed");
    expect(world.verified).toHaveLength(0);
    expect(world.failures[0]?.code).toBe("ORPHAN_DATABASE_REFERENCE");
    expect(world.failures[0]?.details).toEqual([
      "ORPHAN_DATABASE_REFERENCE:c/lost",
    ]);
  });

  test("an original object no database row references is not a success", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    world.addObjectOnly(objectRef("d/orphan"));

    const result = await backup.run();

    expect(result.status).toBe("failed");
    expect(world.verified).toHaveLength(0);
    expect(world.failures[0]?.code).toBe("ORPHAN_OBJECT");
  });

  test("an object whose digest differs from the database reference fails", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    world.corruptObject("a/one");

    expect((await backup.run()).status).toBe("failed");
    expect(world.failures[0]?.code).toBe("OBJECT_MISMATCH");
  });

  test("an object uploaded after the database point is outside the unit", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    const snapshotPoint = world.now();
    world.advance(1000);
    world.addObjectOnly(objectRef("e/late"));

    const objectsAtPoint = await world.objectStore.list(snapshotPoint);

    expect(objectsAtPoint.map((object) => object.key)).toEqual(["a/one"]);
    expect((await backup.run()).status).toBe("failed");
  });

  test("a database outage is a failure record, not a partial success", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    world.outage.database = true;

    const result = await backup.run();

    expect(result.status).toBe("failed");
    expect(world.failures[0]?.code).toBe("SNAPSHOT_UNAVAILABLE");
    expect(world.verified).toHaveLength(0);
  });

  test("an object store outage is its own failure record, not a snapshot problem", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    world.outage.objects = true;

    const result = await backup.run();

    expect(result.status).toBe("failed");
    expect(world.failures[0]?.code).toBe("OBJECT_LIST_UNAVAILABLE");
    expect(world.failures[0]?.details).toEqual([
      "OBJECT_LIST_UNAVAILABLE:list",
    ]);
    expect(world.verified).toHaveLength(0);
  });

  test("a recorded unit re-verifies and then fails when either side is lost", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    const result = await backup.run();
    if (result.status !== "verified") {
      throw new Error("expected a verified unit");
    }

    expect(await backup.verifyRecorded(result.unit)).toEqual({ ok: true });

    world.dropObject("a/one");
    const lostObject = await backup.verifyRecorded(result.unit);
    expect(lostObject.ok).toBe(false);

    world.addObjectOnly(objectRef("a/one"));
    const forged = await backup.verifyRecorded({
      ...result.unit,
      snapshotId: "snap-missing",
    });
    expect(forged).toEqual({ ok: false, problems: ["SNAPSHOT_UNAVAILABLE"] });
  });

  test("only the database-and-object-manifest kind is a backup unit", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    const result = await backup.run();
    if (result.status !== "verified") {
      throw new Error("expected a verified unit");
    }

    for (const kind of ["workspace-exit-package", "trash", "selected-export"]) {
      expect(() => assertIsBackupUnitKind(kind)).toThrow(OperatorBackupError);
      expect(() =>
        backup.openManifest({ ...result.unit, kind: kind as never }),
      ).toThrow(OperatorBackupError);
    }
  });
});

describe("Operator Backup and Alarms: RPO drill", () => {
  const minute = 60 * 1000;

  test("a one minute cadence loses at most five minutes at a random disaster", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    assertCadenceMeetsRpo(minute);

    const drill = await runRpoDrill({
      advance: world.advance,
      backup,
      disasterAfterMs: 3 * 60 * minute + 30_000,
      intervalMs: minute,
      now: world.now,
    });

    expect(drill.verifiedRuns).toBe(drill.runs);
    expect(drill.lossMs).toBe(30_000);
    expect(drill.lossMs).toBeLessThanOrEqual(BACKUP_RPO_TARGET_MS);
    expect(drill.withinTarget).toBe(true);
  });

  test("a five minute cadence is the longest accepted and just meets the target", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    assertCadenceMeetsRpo(BACKUP_RPO_TARGET_MS);

    const drill = await runRpoDrill({
      advance: world.advance,
      backup,
      disasterAfterMs: 60 * minute - 1,
      intervalMs: BACKUP_RPO_TARGET_MS,
      now: world.now,
    });

    expect(drill.lossMs).toBeLessThanOrEqual(BACKUP_RPO_TARGET_MS);
    expect(drill.withinTarget).toBe(true);
  });

  test("a daily-only backup (24 hour loss) is rejected", async () => {
    const day = 24 * 60 * minute;
    expect(() => assertCadenceMeetsRpo(day)).toThrow(OperatorBackupError);
    expect(() => assertCadenceMeetsRpo(BACKUP_RPO_TARGET_MS + 1)).toThrow(
      OperatorBackupError,
    );

    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    const drill = await runRpoDrill({
      advance: world.advance,
      backup,
      disasterAfterMs: 2 * day - minute,
      intervalMs: day,
      now: world.now,
    });
    expect(drill.lossMs).toBeGreaterThan(BACKUP_RPO_TARGET_MS);
    expect(drill.withinTarget).toBe(false);
  });

  test("failed runs do not move the point, so a failing object side breaks the RPO", async () => {
    const { backup, world } = setup();
    world.addAttachment(objectRef("a/one"));
    await runRpoDrill({
      advance: world.advance,
      backup,
      disasterAfterMs: 10 * minute,
      intervalMs: minute,
      now: world.now,
    });
    world.dropObject("a/one");

    const drill = await runRpoDrill({
      advance: world.advance,
      backup,
      disasterAfterMs: 10 * minute,
      intervalMs: minute,
      now: world.now,
    });

    expect(drill.verifiedRuns).toBe(0);
    expect(drill.lossMs).toBeGreaterThan(BACKUP_RPO_TARGET_MS);
    expect(drill.withinTarget).toBe(false);
    expect(world.failures.length).toBeGreaterThan(0);
  });
});
