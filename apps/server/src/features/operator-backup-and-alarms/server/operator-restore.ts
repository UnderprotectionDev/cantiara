import { BackupKeyError } from "./backup-envelope";
import {
  type BackupStorePort,
  type BackupUnitManifest,
  type BackupUnitRecord,
  compareUnitSides,
  type ObjectRef,
  type OperatorBackup,
} from "./operator-backup";
import type { ExternalAccessGateController } from "./restore-access-gate";
import {
  DENYING_EFFECTS,
  type RestoreEffectKind,
  restoreRuleFor,
} from "./restore-rules";
import {
  assertLogOutsidePrimary,
  type LogPlacement,
  type SecurityEventLogPort,
  type SecurityLogEvent,
} from "./security-event-log";

/**
 * Restore runner (spec 85, ADR-0010, ADR-0019). Order is the contract:
 *
 * 1. close all external access;
 * 2. restore the primary (database rows + original objects) from the newest
 *    verified unit, reading the sealed manifest with the key version stored on
 *    its ciphertext and never rewriting that ciphertext;
 * 3. replay the append-only security event log, which lives outside the
 *    primary restore unit, until its frontier stops moving;
 * 4. check integrity (database rows against the object manifest);
 * 5. prove that everything revoked, redacted, deleted or invalidated is still
 *    denied;
 * 6. only then open access.
 *
 * Any failure leaves access closed and records a failure; nothing here opens
 * access on an error path. RTO is the injected-clock time from the start of
 * this run to the opening of access, at most eight hours.
 */

export const RESTORE_RTO_TARGET_MS = 8 * 60 * 60 * 1000;
export const REPLAY_EVENT_VERSION = 1;

export type RestoreFailureCode =
  | "CIPHERTEXT_REWRITTEN"
  | "DENIAL_NOT_ENFORCED"
  | "INTEGRITY_FAILED"
  | "LOG_NOT_SEPARATE"
  | "LOG_UNAVAILABLE"
  | "MANIFEST_UNREADABLE"
  | "NO_VERIFIED_UNIT"
  | "PRIMARY_RESTORE_FAILED"
  | "REPLAY_FAILED"
  | "UNREGISTERED_EVENT_TYPE"
  | "UNSUPPORTED_EVENT_VERSION";

export interface RestoreEffect {
  eventId: string;
  kind: RestoreEffectKind;
  occurredAt: string;
  targetAlias: string;
}

/** The primary after restore: database rows and stored originals. */
export interface PrimaryRestorePort {
  /** Brings rows and original objects back to the manifest's point. */
  restore: (point: {
    objects: readonly ObjectRef[];
    pointAt: string;
    snapshotId: string;
  }) => Promise<void>;
  rowObjectRefs: () => Promise<readonly ObjectRef[]>;
  storedObjects: () => Promise<readonly ObjectRef[]>;
}

/** Where replay re-applies the log's irreversible decisions. */
export interface ReplayTargetPort {
  apply: (effect: RestoreEffect) => Promise<void>;
  /** True when the restored primary now refuses the effect's subject. */
  isDenied: (effect: RestoreEffect) => Promise<boolean>;
}

export interface RestoreFailureRecord {
  at: string;
  code: RestoreFailureCode;
  details: readonly string[];
}

export interface RestoreDrillEvidence {
  /** Effects applied by kind, for the evidence report. */
  effects: Readonly<Partial<Record<RestoreEffectKind, number>>>;
  finishedAt: string;
  /** Key version read from the stored ciphertext; the ciphertext is untouched. */
  keyVersion: number;
  pointAt: string;
  replayedEvents: number;
  replayFrontier: string | null;
  rtoMs: number;
  rtoWithinTarget: boolean;
  snapshotId: string;
  startedAt: string;
  unitId: string;
}

export type RestoreRunResult =
  | { evidence: RestoreDrillEvidence; status: "restored" }
  | { failure: RestoreFailureRecord; status: "failed" };

/** Where #531 reads restore evidence and failures from. */
export interface RestoreEvidenceStore {
  saveEvidence: (evidence: RestoreDrillEvidence) => Promise<void>;
  saveFailure: (failure: RestoreFailureRecord) => Promise<void>;
}

export interface OperatorRestoreDeps {
  backup: OperatorBackup;
  backupStore: Pick<BackupStorePort, "latestVerified">;
  evidence: RestoreEvidenceStore;
  gate: ExternalAccessGateController;
  log: SecurityEventLogPort;
  now: () => Date;
  primary: PrimaryRestorePort;
  primaryPlacement: LogPlacement;
  target: ReplayTargetPort;
}

class RestoreStop extends Error {
  readonly code: RestoreFailureCode;
  readonly details: readonly string[];

  constructor(
    code: RestoreFailureCode,
    options: ErrorOptions & { details?: readonly string[] } = {},
  ) {
    super(code, options);
    this.code = code;
    this.details = options.details ?? [];
  }
}

function effectOf(event: SecurityLogEvent): RestoreEffect {
  if (event.version !== REPLAY_EVENT_VERSION) {
    throw new RestoreStop("UNSUPPORTED_EVENT_VERSION", { details: [event.id] });
  }
  const rule = restoreRuleFor(event.type);
  if (!rule) {
    throw new RestoreStop("UNREGISTERED_EVENT_TYPE", { details: [event.type] });
  }
  return {
    eventId: event.id,
    kind: rule.effect,
    occurredAt: event.occurredAt,
    targetAlias: event.targetAlias,
  };
}

export function createOperatorRestore(deps: OperatorRestoreDeps) {
  async function replayToFrontier(): Promise<{
    applied: RestoreEffect[];
    frontier: string | null;
    replayed: number;
  }> {
    const applied: RestoreEffect[] = [];
    let cursor: string | null = null;
    let replayed = 0;
    let more = true;
    while (more) {
      let batch: Awaited<ReturnType<SecurityEventLogPort["readAfter"]>>;
      try {
        // biome-ignore lint/performance/noAwaitInLoops: Replay is ordered by definition.
        batch = await deps.log.readAfter(cursor);
      } catch (cause) {
        throw new RestoreStop("LOG_UNAVAILABLE", { cause });
      }
      for (const event of batch.events) {
        const effect = effectOf(event);
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Events apply in log order.
          await deps.target.apply(effect);
        } catch (cause) {
          throw new RestoreStop("REPLAY_FAILED", {
            cause,
            details: [event.id],
          });
        }
        replayed += 1;
        if (effect.kind !== "none") {
          applied.push(effect);
        }
      }
      cursor = batch.frontier;
      // The frontier is current only when a read after it returns nothing new.
      more = batch.events.length > 0;
    }
    return { applied, frontier: cursor, replayed };
  }

  async function checkIntegrity(manifest: BackupUnitManifest): Promise<void> {
    const rows = await deps.primary.rowObjectRefs();
    const stored = await deps.primary.storedObjects();
    const problems = compareUnitSides(
      { objectRefs: rows, pointAt: new Date(0), snapshotId: "" },
      stored,
    );
    // A row that is in the manifest must carry the manifest's digest: restore
    // must not have rewritten an original.
    const manifestByKey = new Map(manifest.objects.map((o) => [o.key, o]));
    const drifted = rows
      .filter((row) => {
        const known = manifestByKey.get(row.key);
        return (
          known && (known.sha256 !== row.sha256 || known.size !== row.size)
        );
      })
      .map((row) => row.key);
    const details = [
      ...problems.flatMap((p) => p.details.map((d) => `${p.code}:${d}`)),
      ...drifted.map((key) => `MANIFEST_DRIFT:${key}`),
    ];
    if (details.length > 0) {
      throw new RestoreStop("INTEGRITY_FAILED", { details });
    }
  }

  async function openUnit(): Promise<{
    manifest: BackupUnitManifest;
    unit: BackupUnitRecord;
  }> {
    try {
      assertLogOutsidePrimary(deps.primaryPlacement, deps.log.placement());
    } catch (cause) {
      throw new RestoreStop("LOG_NOT_SEPARATE", { cause });
    }
    const unit = await deps.backupStore.latestVerified();
    if (!unit) {
      throw new RestoreStop("NO_VERIFIED_UNIT");
    }
    try {
      return { manifest: deps.backup.openManifest(unit), unit };
    } catch (cause) {
      throw new RestoreStop("MANIFEST_UNREADABLE", {
        cause,
        details: [cause instanceof BackupKeyError ? cause.code : "OPEN_FAILED"],
      });
    }
  }

  async function proveDenial(applied: readonly RestoreEffect[]) {
    const notDenied: string[] = [];
    for (const effect of applied) {
      if (!DENYING_EFFECTS.has(effect.kind)) {
        continue;
      }
      // biome-ignore lint/performance/noAwaitInLoops: Sequential proof keeps the details ordered.
      if (!(await deps.target.isDenied(effect))) {
        notDenied.push(`${effect.kind}:${effect.targetAlias}`);
      }
    }
    if (notDenied.length > 0) {
      throw new RestoreStop("DENIAL_NOT_ENFORCED", { details: notDenied });
    }
  }

  async function execute(startedAt: Date): Promise<RestoreRunResult> {
    deps.gate.close("restore-in-progress");
    const { manifest, unit } = await openUnit();
    const sealedBefore = JSON.stringify(unit.sealed);
    try {
      await deps.primary.restore({
        objects: manifest.objects,
        pointAt: manifest.pointAt,
        snapshotId: manifest.snapshotId,
      });
    } catch (cause) {
      throw new RestoreStop("PRIMARY_RESTORE_FAILED", { cause });
    }
    const { applied, frontier, replayed } = await replayToFrontier();
    await checkIntegrity(manifest);
    await proveDenial(applied);

    const after = await deps.backupStore.latestVerified();
    if (!after || JSON.stringify(after.sealed) !== sealedBefore) {
      throw new RestoreStop("CIPHERTEXT_REWRITTEN", { details: [unit.unitId] });
    }

    deps.gate.open("restore-verified");
    const finishedAt = deps.now();
    const rtoMs = finishedAt.getTime() - startedAt.getTime();
    const effects: Partial<Record<RestoreEffectKind, number>> = {};
    for (const effect of applied) {
      effects[effect.kind] = (effects[effect.kind] ?? 0) + 1;
    }
    const evidence: RestoreDrillEvidence = {
      effects,
      finishedAt: finishedAt.toISOString(),
      keyVersion: unit.sealed.keyVersion,
      pointAt: unit.pointAt,
      replayedEvents: replayed,
      replayFrontier: frontier,
      rtoMs,
      rtoWithinTarget: rtoMs <= RESTORE_RTO_TARGET_MS,
      snapshotId: unit.snapshotId,
      startedAt: startedAt.toISOString(),
      unitId: unit.unitId,
    };
    await deps.evidence.saveEvidence(evidence);
    return { evidence, status: "restored" };
  }

  return {
    /** One restore run. Never throws; access stays closed on every failure. */
    async run(): Promise<RestoreRunResult> {
      const startedAt = deps.now();
      try {
        return await execute(startedAt);
      } catch (error) {
        deps.gate.close("restore-failed");
        const failure: RestoreFailureRecord = {
          at: deps.now().toISOString(),
          code: error instanceof RestoreStop ? error.code : "REPLAY_FAILED",
          details: error instanceof RestoreStop ? error.details : [],
        };
        await deps.evidence.saveFailure(failure);
        return { failure, status: "failed" };
      }
    },
  };
}

export type OperatorRestore = ReturnType<typeof createOperatorRestore>;
