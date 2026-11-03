import type {
  DatabaseSnapshot,
  DatabaseSnapshotPort,
  ObjectRef,
} from "../operator-backup";
import type {
  RestoreDrillEvidence,
  RestoreEffect,
  RestoreFailureRecord,
} from "../operator-restore";
import {
  createExternalAccessGate,
  type ExternalAccessKind,
} from "../restore-access-gate";
import {
  createGuardedSecurityLog,
  type LogPlacement,
  type SecurityEventLogPort,
  type SecurityLogEvent,
} from "../security-event-log";
import type { BackupWorld } from "./operator-backup-memory";

export const PRIMARY_PLACEMENT: LogPlacement = {
  credentialId: "primary-credential",
  projectId: "primary-project",
  region: "eu",
};

export const LOG_PLACEMENT: LogPlacement = {
  credentialId: "log-credential",
  projectId: "log-project",
  region: "eu",
};

interface AccessState {
  redacted: Set<string>;
  sessions: Map<string, boolean>;
  surfaces: Map<string, boolean>;
}

const cloneState = (state: AccessState): AccessState => ({
  redacted: new Set(state.redacted),
  sessions: new Map(state.sessions),
  surfaces: new Map(state.surfaces),
});

/**
 * In-process restore world on top of the backup world: access state (sessions,
 * surfaces, redactions) is captured with each database snapshot, the security
 * log is a separate store that a primary restore never touches, and the
 * clock advances by configured step durations so RTO is measured, not assumed.
 */
export function createRestoreWorld(
  backup: BackupWorld,
  options: { logPlacement?: LogPlacement } = {},
) {
  let state: AccessState = {
    redacted: new Set(),
    sessions: new Map(),
    surfaces: new Map(),
  };
  const savedStates = new Map<string, AccessState>();
  const logEvents: SecurityLogEvent[] = [];
  const evidence: RestoreDrillEvidence[] = [];
  const failures: RestoreFailureRecord[] = [];
  const faults: {
    applyFails: boolean;
    logUnreachable: boolean;
    skipKinds: Set<string>;
  } = {
    applyFails: false,
    logUnreachable: false,
    skipKinds: new Set<string>(),
  };
  const durations = { perEventMs: 1000, primaryMs: 60 * 60 * 1000 };
  const { controller, gate } = createExternalAccessGate();

  const rawLog: SecurityEventLogPort = {
    append(event) {
      logEvents.push(event);
      return Promise.resolve();
    },
    placement: () => options.logPlacement ?? LOG_PLACEMENT,
    readAfter(after) {
      if (faults.logUnreachable) {
        return Promise.reject(new Error("log unreachable"));
      }
      const start = after === null ? 0 : Number(after);
      return Promise.resolve({
        events: logEvents.slice(start),
        frontier: String(logEvents.length),
      });
    },
  };

  const database: DatabaseSnapshotPort = {
    async capture(): Promise<DatabaseSnapshot> {
      const snapshot = await backup.database.capture();
      savedStates.set(snapshot.snapshotId, cloneState(state));
      return snapshot;
    },
    read: (snapshotId) => backup.database.read(snapshotId),
  };

  return {
    /** The live application's answer, as the edge would give it. */
    canServe(kind: ExternalAccessKind, alias: string): boolean {
      if (!gate.allows(kind)) {
        return false;
      }
      if (kind === "visitor-session") {
        return state.sessions.get(alias) === true;
      }
      if (kind === "external-surface") {
        return state.surfaces.get(alias) === true;
      }
      return (
        backup.rowRefs().some((ref) => ref.key === alias) &&
        !state.redacted.has(alias)
      );
    },
    controller,
    database,
    durations,
    evidence,
    failures,
    faults,
    gate,
    log: rawLog,
    guardedLog: () => createGuardedSecurityLog(rawLog, PRIMARY_PLACEMENT),
    logEvents,
    openSession(alias: string) {
      state.sessions.set(alias, true);
    },
    openSurface(alias: string) {
      state.surfaces.set(alias, true);
    },
    primary: {
      restore(point: { objects: readonly ObjectRef[]; snapshotId: string }) {
        backup.resetPrimary(point.objects);
        state = cloneState(
          savedStates.get(point.snapshotId) ?? {
            redacted: new Set(),
            sessions: new Map(),
            surfaces: new Map(),
          },
        );
        backup.advance(durations.primaryMs);
        return Promise.resolve();
      },
      rowObjectRefs: () => Promise.resolve(backup.rowRefs()),
      storedObjects: () => Promise.resolve(backup.storedRefs()),
    },
    store: {
      saveEvidence(item: RestoreDrillEvidence) {
        evidence.push(item);
        return Promise.resolve();
      },
      saveFailure(item: RestoreFailureRecord) {
        failures.push(item);
        return Promise.resolve();
      },
    },
    target: {
      apply(effect: RestoreEffect) {
        if (faults.applyFails) {
          return Promise.reject(new Error("replay target down"));
        }
        backup.advance(durations.perEventMs);
        if (faults.skipKinds.has(effect.kind)) {
          return Promise.resolve();
        }
        switch (effect.kind) {
          case "revoke-session":
            state.sessions.set(effect.targetAlias, false);
            break;
          case "close-surface":
          case "invalidate-secret":
            state.surfaces.set(effect.targetAlias, false);
            break;
          case "remove-record":
            backup.removeAttachment(effect.targetAlias);
            break;
          case "redact-record":
            state.redacted.add(effect.targetAlias);
            break;
          default:
            break;
        }
        return Promise.resolve();
      },
      isDenied(effect: RestoreEffect) {
        switch (effect.kind) {
          case "revoke-session":
            return Promise.resolve(
              state.sessions.get(effect.targetAlias) !== true,
            );
          case "close-surface":
          case "invalidate-secret":
            return Promise.resolve(
              state.surfaces.get(effect.targetAlias) !== true,
            );
          case "remove-record":
            return Promise.resolve(
              !backup.rowRefs().some((ref) => ref.key === effect.targetAlias),
            );
          case "redact-record":
            return Promise.resolve(state.redacted.has(effect.targetAlias));
          default:
            return Promise.resolve(true);
        }
      },
    },
  };
}

export type RestoreWorld = ReturnType<typeof createRestoreWorld>;

let eventCounter = 0;
export function logEvent(
  type: string,
  targetAlias: string,
  occurredAt: Date,
): SecurityLogEvent {
  eventCounter += 1;
  return {
    actorAlias: "actor-7f3a",
    id: `${type}:${targetAlias}:${eventCounter}`,
    occurredAt: occurredAt.toISOString(),
    targetAlias,
    type,
    version: 1,
  };
}
