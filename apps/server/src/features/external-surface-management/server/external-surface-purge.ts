import type {
  PurgeRequest,
  PurgeStatus,
} from "@cantiara/api/external-surface-management";

export interface PurgeRecord {
  attempts: number;
  completedAt: Date | null;
  nextAttemptAt: Date;
  status: PurgeStatus;
  surfaceId: string;
}

export interface SurfacePurgeStore {
  /** The unfinished requests whose next attempt is due. */
  due: (now: Date, limit: number) => Promise<PurgeRecord[]>;
  /** Queues one `Pending` request per removed surface that has none; idempotent. */
  ensure: (surfaceId?: string) => Promise<void>;
  save: (record: PurgeRecord) => Promise<void>;
  statuses: (surfaceIds: string[]) => Promise<PurgeRecord[]>;
}

/** One cache or index the product controls; throwing schedules a retry. */
export type PurgeTarget = (surfaceId: string) => Promise<void>;

export interface SurfacePurges {
  /** Queues and attempts once; a failure is recorded for retry and never thrown. */
  request: (surfaceId: string) => Promise<PurgeRequest>;
  status: (surfaceIds: string[]) => Promise<Map<string, PurgeRequest>>;
  /** Attempts every due request; returns how many were attempted. */
  sweep: () => Promise<number>;
}

const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BASE_BACKOFF_MS = 60 * 1000;
const SWEEP_LIMIT = 100;

/** Doubling delay from one minute to an hour; nothing here ever reopens a surface. */
export function purgeBackoffMs(attempts: number) {
  return Math.min(
    BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1),
    MAX_BACKOFF_MS,
  );
}

export function toPurgeRequest(record: PurgeRecord): PurgeRequest {
  return {
    attempts: record.attempts,
    nextAttemptAt:
      record.status === "Done" ? null : record.nextAttemptAt.toISOString(),
    status: record.status,
  };
}

export function createSurfacePurges(options: {
  now?: () => Date;
  store: SurfacePurgeStore;
  targets: readonly PurgeTarget[];
}): SurfacePurges {
  const { store, targets } = options;
  const now = options.now ?? (() => new Date());

  async function attempt(record: PurgeRecord): Promise<PurgeRecord> {
    const moment = now();
    let next: PurgeRecord;
    try {
      for (const target of targets) {
        // biome-ignore lint/performance/noAwaitInLoops: targets purge one after another so a failure names where it stopped.
        await target(record.surfaceId);
      }
      next = {
        ...record,
        attempts: record.attempts + 1,
        completedAt: moment,
        status: "Done",
      };
    } catch {
      const attempts = record.attempts + 1;
      next = {
        ...record,
        attempts,
        nextAttemptAt: new Date(moment.getTime() + purgeBackoffMs(attempts)),
        status: "Retrying",
      };
    }
    await store.save(next);
    return next;
  }

  return {
    async request(surfaceId) {
      await store.ensure(surfaceId);
      const [record] = await store.statuses([surfaceId]);
      if (!record) {
        return { attempts: 0, nextAttemptAt: null, status: "Pending" };
      }
      return toPurgeRequest(
        record.status === "Done" ? record : await attempt(record),
      );
    },

    async status(surfaceIds) {
      const records = await store.statuses(surfaceIds);
      return new Map(
        records.map((record) => [record.surfaceId, toPurgeRequest(record)]),
      );
    },

    async sweep() {
      await store.ensure();
      const due = await store.due(now(), SWEEP_LIMIT);
      for (const record of due) {
        // biome-ignore lint/performance/noAwaitInLoops: one purge at a time keeps the sweep gentle on the cache.
        await attempt(record);
      }
      return due.length;
    },
  };
}
