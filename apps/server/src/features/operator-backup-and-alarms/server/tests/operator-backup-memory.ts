import type {
  BackupFailureRecord,
  BackupStorePort,
  BackupUnitRecord,
  DatabaseSnapshot,
  DatabaseSnapshotPort,
  ObjectRef,
  OriginalObjectStorePort,
} from "../operator-backup";

interface StoredObject extends ObjectRef {
  uploadedAt: Date;
}

/**
 * In-process world for the Operator Backup and Alarms seam: database rows that
 * reference original objects, an object store with upload times, an injected
 * clock, and the backup store. No provider, no database.
 */
export function createBackupWorld(start = new Date("2026-11-02T10:00:00Z")) {
  const clock = { now: start };
  const rows = new Map<string, ObjectRef>();
  const objects = new Map<string, StoredObject>();
  const snapshots = new Map<string, DatabaseSnapshot>();
  const verified: BackupUnitRecord[] = [];
  const failures: BackupFailureRecord[] = [];
  const outage: { database: boolean } = { database: false };
  let snapshotCounter = 0;

  const database: DatabaseSnapshotPort = {
    capture() {
      if (outage.database) {
        return Promise.reject(new Error("database snapshot unavailable"));
      }
      snapshotCounter += 1;
      const snapshot: DatabaseSnapshot = {
        objectRefs: [...rows.values()],
        pointAt: new Date(clock.now),
        snapshotId: `snap-${snapshotCounter}`,
      };
      snapshots.set(snapshot.snapshotId, snapshot);
      return Promise.resolve(snapshot);
    },
    read: (snapshotId) => Promise.resolve(snapshots.get(snapshotId) ?? null),
  };

  const objectStore: OriginalObjectStorePort = {
    list: (upTo) =>
      Promise.resolve(
        [...objects.values()]
          .filter((object) => object.uploadedAt <= upTo)
          .map(({ key, sha256, size }) => ({ key, sha256, size })),
      ),
  };

  const store: BackupStorePort = {
    latestVerified: () => Promise.resolve(verified.at(-1) ?? null),
    saveFailure: (failure) => {
      failures.push(failure);
      return Promise.resolve();
    },
    saveVerified: (unit) => {
      verified.push(unit);
      return Promise.resolve();
    },
  };

  let unitCounter = 0;
  return {
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
    database,
    failures,
    /** Row and object together: the normal state. */
    addAttachment(item: ObjectRef) {
      rows.set(item.key, item);
      objects.set(item.key, { ...item, uploadedAt: new Date(clock.now) });
    },
    newUnitId: () => {
      unitCounter += 1;
      return `unit-${unitCounter}`;
    },
    now: () => new Date(clock.now),
    objectStore,
    outage,
    /** Only the row: an orphan database reference. */
    addRowOnly(item: ObjectRef) {
      rows.set(item.key, item);
    },
    /** Only the object: an orphan original. */
    addObjectOnly(item: ObjectRef) {
      objects.set(item.key, { ...item, uploadedAt: new Date(clock.now) });
    },
    corruptObject(key: string) {
      const object = objects.get(key);
      if (object) {
        objects.set(key, { ...object, sha256: "f".repeat(64) });
      }
    },
    dropObject(key: string) {
      objects.delete(key);
    },
    store,
    verified,
  };
}

export type BackupWorld = ReturnType<typeof createBackupWorld>;

export const objectRef = (key: string, size = 10): ObjectRef => ({
  key,
  sha256: key.charCodeAt(0).toString(16).padStart(64, "0"),
  size,
});
