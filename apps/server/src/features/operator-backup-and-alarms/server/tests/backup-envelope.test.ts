import { randomBytes } from "node:crypto";

import { describe, expect, test } from "vitest";

import {
  BackupKeyError,
  createBackupSealer,
  createEphemeralBackupKeyRing,
  parseBackupKeyRing,
  rotateBackupKeyRing,
} from "../backup-envelope";

describe("Operator Backup and Alarms: backup key scope", () => {
  test("stores the key version with the ciphertext and round-trips", () => {
    const sealer = createBackupSealer(createEphemeralBackupKeyRing());
    const sealed = sealer.seal("manifest", "unit:1");
    expect(sealed.keyVersion).toBe(1);
    expect(sealed.scope).toBe("backup");
    expect(sealed.ciphertext).not.toContain("manifest");
    expect(sealer.open(sealed, "unit:1")).toBe("manifest");
    expect(() => sealer.open(sealed, "unit:2")).toThrow(BackupKeyError);
  });

  test("rotation adds a version and leaves existing ciphertext untouched", () => {
    const ring1 = createEphemeralBackupKeyRing();
    const old = createBackupSealer(ring1).seal("old", "unit:1");
    const snapshot = JSON.stringify(old);

    const ring2 = rotateBackupKeyRing(ring1);
    const rotated = createBackupSealer(ring2);

    expect(ring2.currentVersion).toBe(2);
    expect([...ring2.keys.keys()]).toEqual([1, 2]);
    expect(rotated.seal("new", "unit:2").keyVersion).toBe(2);
    expect(rotated.open(old, "unit:1")).toBe("old");
    expect(JSON.stringify(old)).toBe(snapshot);
  });

  test("a ring without the stored version cannot open it", () => {
    const ring1 = createEphemeralBackupKeyRing();
    const sealed = createBackupSealer(ring1).seal("x", "a");
    const other = createBackupSealer(createEphemeralBackupKeyRing());
    expect(() => other.open(sealed, "a")).toThrow(BackupKeyError);
    expect(() =>
      createBackupSealer({
        currentVersion: 3,
        keys: new Map([[3, randomBytes(32)]]),
      }).open(sealed, "a"),
    ).toThrow(BackupKeyError);
  });

  test("the backup scope is separate: identical key bytes of another scope do not open", () => {
    const key = randomBytes(32);
    const ring = { currentVersion: 1, keys: new Map([[1, key]]) };
    const sealer = createBackupSealer(ring);
    const sealed = sealer.seal("secret", "a");
    expect(() =>
      sealer.open({ ...sealed, scope: "export" as never }, "a"),
    ).toThrow(BackupKeyError);
  });

  test("parses the environment key ring format and rejects malformed entries", () => {
    const a = randomBytes(32).toString("base64");
    const b = randomBytes(32).toString("base64");
    const ring = parseBackupKeyRing(`1:${a},2:${b}`, 2);
    expect(ring.currentVersion).toBe(2);
    expect(() => parseBackupKeyRing(`1:${a}`, 2)).toThrow(BackupKeyError);
    expect(() => parseBackupKeyRing("1:short", 1)).toThrow(BackupKeyError);
  });
});
