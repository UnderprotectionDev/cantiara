import { createHash } from "node:crypto";

import type { BackupSealer, SealedBackup } from "./backup-envelope";

/**
 * Operasyonel yedek (spec 85, ADR-0010): the database snapshot point and the
 * exact manifest of original objects (R2) are ONE logical unit. A unit is
 * recorded as verified only when both sides agree at the same point; one side
 * alone is never a success. RPO is at most five minutes. The unit is an
 * operator artifact: it is not a Workspace Exit Package (82), not Trash (77)
 * and offers no restore-point, calendar or founder command.
 */

export const BACKUP_RPO_TARGET_MS = 5 * 60 * 1000;
export const BACKUP_UNIT_KIND = "database-and-object-manifest" as const;

export type BackupFailureCode =
  | "CADENCE_TOO_LONG"
  | "NOT_A_BACKUP_UNIT"
  | "OBJECT_LIST_UNAVAILABLE"
  | "OBJECT_MISMATCH"
  | "ORPHAN_DATABASE_REFERENCE"
  | "ORPHAN_OBJECT"
  | "SNAPSHOT_UNAVAILABLE";

export class OperatorBackupError extends Error {
  readonly code: BackupFailureCode;

  constructor(code: BackupFailureCode, message: string) {
    super(message);
    this.name = "OperatorBackupError";
    this.code = code;
  }
}

export interface ObjectRef {
  key: string;
  sha256: string;
  size: number;
}

/** What the database snapshot holds: its logical point and the objects its rows reference. */
export interface DatabaseSnapshot {
  objectRefs: readonly ObjectRef[];
  pointAt: Date;
  snapshotId: string;
}

export interface DatabaseSnapshotPort {
  /** Takes (or reads the continuously archived) snapshot at the newest consistent point. */
  capture: () => Promise<DatabaseSnapshot>;
  /** Reads a previously captured snapshot, or null when the provider no longer has it. */
  read: (snapshotId: string) => Promise<DatabaseSnapshot | null>;
}

export interface OriginalObjectStorePort {
  /** Original objects (never derived variants) stored at or before `upTo`. */
  list: (upTo: Date) => Promise<readonly ObjectRef[]>;
}

export interface BackupUnitManifest {
  kind: typeof BACKUP_UNIT_KIND;
  objects: readonly ObjectRef[];
  pointAt: string;
  snapshotId: string;
}

/** The stored unit: metadata in the clear, the manifest sealed under the backup key scope. */
export interface BackupUnitRecord {
  completedAt: string;
  kind: typeof BACKUP_UNIT_KIND;
  manifestSha256: string;
  objectCount: number;
  pointAt: string;
  sealed: SealedBackup;
  snapshotId: string;
  unitId: string;
}

export interface BackupFailureRecord {
  at: string;
  code: BackupFailureCode;
  details: readonly string[];
}

export interface BackupStorePort {
  latestVerified: () => Promise<BackupUnitRecord | null>;
  saveFailure: (failure: BackupFailureRecord) => Promise<void>;
  saveVerified: (unit: BackupUnitRecord) => Promise<void>;
}

export type BackupRunResult =
  | { status: "failed"; failure: BackupFailureRecord }
  | { status: "verified"; unit: BackupUnitRecord };

export interface OperatorBackupDeps {
  database: DatabaseSnapshotPort;
  newUnitId: () => string;
  now: () => Date;
  objects: OriginalObjectStorePort;
  sealer: BackupSealer;
  store: BackupStorePort;
}

interface SideProblem {
  code: BackupFailureCode;
  details: string[];
}

function canonicalManifest(manifest: BackupUnitManifest): string {
  const objects = [...manifest.objects]
    .sort((a, b) => {
      if (a.key === b.key) {
        return 0;
      }
      return a.key < b.key ? -1 : 1;
    })
    .map(({ key, sha256: digest, size }) => ({ key, sha256: digest, size }));
  return JSON.stringify({
    kind: manifest.kind,
    objects,
    pointAt: manifest.pointAt,
    snapshotId: manifest.snapshotId,
  });
}

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

const aadOf = (unitId: string) => `unit:${unitId}`;

/**
 * Compares the database side with the object side at one point. Returns every
 * discrepancy; an empty list means the two sides are the same logical unit.
 */
export function compareUnitSides(
  database: DatabaseSnapshot,
  stored: readonly ObjectRef[],
): SideProblem[] {
  const byKey = new Map(stored.map((ref) => [ref.key, ref]));
  const referenced = new Set<string>();
  const orphanRows: string[] = [];
  const mismatched: string[] = [];
  for (const ref of database.objectRefs) {
    referenced.add(ref.key);
    const object = byKey.get(ref.key);
    if (!object) {
      orphanRows.push(ref.key);
    } else if (object.sha256 !== ref.sha256 || object.size !== ref.size) {
      mismatched.push(ref.key);
    }
  }
  const orphanObjects = stored
    .filter((ref) => !referenced.has(ref.key))
    .map((ref) => ref.key);
  const problems: SideProblem[] = [];
  if (orphanRows.length > 0) {
    problems.push({
      code: "ORPHAN_DATABASE_REFERENCE",
      details: orphanRows.sort(),
    });
  }
  if (orphanObjects.length > 0) {
    problems.push({ code: "ORPHAN_OBJECT", details: orphanObjects.sort() });
  }
  if (mismatched.length > 0) {
    problems.push({ code: "OBJECT_MISMATCH", details: mismatched.sort() });
  }
  return problems;
}

/** The only accepted cadence is at most the RPO; a daily-only schedule is rejected. */
export function assertCadenceMeetsRpo(intervalMs: number): void {
  if (!(intervalMs > 0 && intervalMs <= BACKUP_RPO_TARGET_MS)) {
    throw new OperatorBackupError(
      "CADENCE_TOO_LONG",
      `A backup cadence of ${intervalMs} ms cannot meet an RPO of ${BACKUP_RPO_TARGET_MS} ms.`,
    );
  }
}

/** Exit packages (82), Trash (77) and Selected Exports (79) are not this unit. */
export function assertIsBackupUnitKind(kind: string): void {
  if (kind !== BACKUP_UNIT_KIND) {
    throw new OperatorBackupError(
      "NOT_A_BACKUP_UNIT",
      `"${kind}" is not the operational backup unit.`,
    );
  }
}

export function createOperatorBackup(deps: OperatorBackupDeps) {
  const fail = async (problems: SideProblem[]): Promise<BackupRunResult> => {
    const failure: BackupFailureRecord = {
      at: deps.now().toISOString(),
      code: problems[0]?.code ?? "SNAPSHOT_UNAVAILABLE",
      details: problems.flatMap((problem) =>
        problem.details.map((detail) => `${problem.code}:${detail}`),
      ),
    };
    await deps.store.saveFailure(failure);
    return { failure, status: "failed" };
  };

  function openManifest(unit: BackupUnitRecord): BackupUnitManifest {
    assertIsBackupUnitKind(unit.kind);
    const canonical = deps.sealer.open(unit.sealed, aadOf(unit.unitId));
    if (sha256(canonical) !== unit.manifestSha256) {
      throw new OperatorBackupError(
        "OBJECT_MISMATCH",
        "The sealed manifest does not match its recorded digest.",
      );
    }
    return JSON.parse(canonical) as BackupUnitManifest;
  }

  return {
    /** Loss in ms if the provider failed now: time since the newest verified point. */
    async currentRpoLossMs(): Promise<number | null> {
      const latest = await deps.store.latestVerified();
      return latest
        ? deps.now().getTime() - new Date(latest.pointAt).getTime()
        : null;
    },

    /**
     * Opens the sealed manifest with the key version stored on the ciphertext
     * and checks it against its digest. Restore (#530) starts here.
     */
    openManifest,

    /**
     * One backup run: capture the database point, list the originals at that
     * same point, require agreement, then seal and record the single unit.
     */
    async run(): Promise<BackupRunResult> {
      let snapshot: DatabaseSnapshot;
      try {
        snapshot = await deps.database.capture();
      } catch {
        return await fail([
          { code: "SNAPSHOT_UNAVAILABLE", details: ["capture"] },
        ]);
      }
      let objects: readonly ObjectRef[];
      try {
        objects = await deps.objects.list(snapshot.pointAt);
      } catch {
        return await fail([
          { code: "OBJECT_LIST_UNAVAILABLE", details: ["list"] },
        ]);
      }
      const problems = compareUnitSides(snapshot, objects);
      if (problems.length > 0) {
        return await fail(problems);
      }
      const unitId = deps.newUnitId();
      const manifest: BackupUnitManifest = {
        kind: BACKUP_UNIT_KIND,
        objects: snapshot.objectRefs,
        pointAt: snapshot.pointAt.toISOString(),
        snapshotId: snapshot.snapshotId,
      };
      const canonical = canonicalManifest(manifest);
      const unit: BackupUnitRecord = {
        completedAt: deps.now().toISOString(),
        kind: BACKUP_UNIT_KIND,
        manifestSha256: sha256(canonical),
        objectCount: snapshot.objectRefs.length,
        pointAt: manifest.pointAt,
        sealed: deps.sealer.seal(canonical, aadOf(unitId)),
        snapshotId: snapshot.snapshotId,
        unitId,
      };
      await deps.store.saveVerified(unit);
      return { status: "verified", unit };
    },

    /**
     * Re-verifies a recorded unit against the providers: the sealed manifest
     * opens, the database snapshot still exists at the same point, and the
     * database references, the sealed manifest and the stored originals agree.
     */
    async verifyRecorded(
      unit: BackupUnitRecord,
    ): Promise<{ ok: true } | { ok: false; problems: BackupFailureCode[] }> {
      const manifest = openManifest(unit);
      const snapshot = await deps.database.read(unit.snapshotId);
      if (!snapshot || snapshot.pointAt.toISOString() !== unit.pointAt) {
        return { ok: false, problems: ["SNAPSHOT_UNAVAILABLE"] };
      }
      const stored = await deps.objects.list(snapshot.pointAt);
      const codes = [
        ...compareUnitSides(snapshot, stored),
        ...compareUnitSides(
          { ...snapshot, objectRefs: manifest.objects },
          stored,
        ),
      ].map((problem) => problem.code);
      return codes.length === 0
        ? { ok: true }
        : { ok: false, problems: [...new Set(codes)] };
    },
  };
}

export type OperatorBackup = ReturnType<typeof createOperatorBackup>;

export interface RpoDrillResult {
  lossMs: number;
  runs: number;
  verifiedRuns: number;
  withinTarget: boolean;
}

/**
 * Synthetic RPO drill on an injected clock: runs the backup every
 * `intervalMs` until `disasterAfterMs`, then measures the data loss as the
 * time from the newest verified point to the disaster. A failed run does not
 * move the point. The drill has no restore step; replay and RTO are 02/#530.
 */
export async function runRpoDrill(options: {
  advance: (ms: number) => void;
  backup: OperatorBackup;
  disasterAfterMs: number;
  intervalMs: number;
  now: () => Date;
}): Promise<RpoDrillResult> {
  const { advance, backup, disasterAfterMs, intervalMs, now } = options;
  const started = now().getTime();
  let runs = 0;
  let verifiedRuns = 0;
  while (now().getTime() - started + intervalMs <= disasterAfterMs) {
    advance(intervalMs);
    runs += 1;
    // biome-ignore lint/performance/noAwaitInLoops: Backup runs are sequential by definition.
    if ((await backup.run()).status === "verified") {
      verifiedRuns += 1;
    }
  }
  advance(started + disasterAfterMs - now().getTime());
  const lossMs = (await backup.currentRpoLossMs()) ?? disasterAfterMs;
  return {
    lossMs,
    runs,
    verifiedRuns,
    withinTarget: lossMs <= BACKUP_RPO_TARGET_MS,
  };
}
