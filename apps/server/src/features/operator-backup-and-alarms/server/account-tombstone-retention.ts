/**
 * Hesap silme tombstone'u (spec 84, spec 85): kept for the longest operational
 * backup/restore window plus 30 days, then physically deleted. A younger
 * tombstone must survive so a restored older backup cannot resurrect the
 * account; an older one is removed so the log does not hold the account
 * forever.
 */
export const TOMBSTONE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export function tombstoneRetentionMs(longestBackupWindowMs: number): number {
  if (!(longestBackupWindowMs > 0)) {
    throw new RangeError("The longest backup window must be positive.");
  }
  return longestBackupWindowMs + TOMBSTONE_GRACE_MS;
}

export function tombstonePurgeAt(
  deletedAt: Date,
  longestBackupWindowMs: number,
): Date {
  return new Date(
    deletedAt.getTime() + tombstoneRetentionMs(longestBackupWindowMs),
  );
}

/** Tombstones that are due for physical deletion at `now`. */
export function dueTombstones<T extends { deletedAt: Date }>(
  tombstones: readonly T[],
  now: Date,
  longestBackupWindowMs: number,
): T[] {
  return tombstones.filter(
    (tombstone) =>
      tombstonePurgeAt(tombstone.deletedAt, longestBackupWindowMs).getTime() <=
      now.getTime(),
  );
}
