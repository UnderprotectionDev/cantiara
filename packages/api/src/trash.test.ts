import { describe, expect, test } from "vitest";

import {
  isTrashChildOnlyKind,
  isTrashRecordKind,
  keepApprovedSurfaceEligibility,
  MOVE_TO_TRASH_LABEL,
  moveToTrashInputSchema,
  TRASH_LABEL,
  TRASH_RETENTION_DAYS,
  trashExpiresAt,
} from "./trash";

describe("Trash rules", () => {
  test("uses the English labels", () => {
    expect(TRASH_LABEL).toBe("Trash");
    expect(MOVE_TO_TRASH_LABEL).toBe("Move to Trash");
  });

  test("expires exactly 30 fixed 24-hour days after the move, across a DST change", () => {
    const trashedAt = new Date("2026-03-01T00:00:00.000Z");

    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(trashExpiresAt(trashedAt).toISOString()).toBe(
      "2026-03-31T00:00:00.000Z",
    );
  });

  test("a Session Test is child-only and not a movable primary kind", () => {
    expect(isTrashChildOnlyKind("Session Test")).toBe(true);
    expect(isTrashRecordKind("Session Test")).toBe(false);
    expect(isTrashRecordKind("Work")).toBe(true);
  });

  test("the move needs a base revision and an idempotency key", () => {
    const valid = {
      baseRevision: 1,
      clientIdempotencyKey: "k",
      projectId: "p",
      recordId: "r",
      recordKind: "Risk",
    };

    expect(moveToTrashInputSchema.safeParse(valid).success).toBe(true);
    expect(
      moveToTrashInputSchema.safeParse({ ...valid, baseRevision: undefined })
        .success,
    ).toBe(false);
    expect(
      moveToTrashInputSchema.safeParse({
        ...valid,
        clientIdempotencyKey: undefined,
      }).success,
    ).toBe(false);
    expect(
      moveToTrashInputSchema.safeParse({ ...valid, recordKind: "Capture" })
        .success,
    ).toBe(false);
  });

  test("Keep approved surface is eligible only for one record in a living container", () => {
    const base = {
      container: "project",
      deletion: "record",
      sourceCount: 1,
    } as const;

    expect(keepApprovedSurfaceEligibility(base)).toEqual({ eligible: true });
    for (const container of ["workspace", "personal-wiki"] as const) {
      expect(
        keepApprovedSurfaceEligibility({ ...base, container }).eligible,
      ).toBe(true);
    }
    expect(
      keepApprovedSurfaceEligibility({ ...base, container: "gone" }).eligible,
    ).toBe(false);
    expect(
      keepApprovedSurfaceEligibility({ ...base, sourceCount: 2 }).eligible,
    ).toBe(false);
    for (const deletion of [
      "project",
      "project-delete-group",
      "workspace",
      "account",
    ] as const) {
      expect(
        keepApprovedSurfaceEligibility({ ...base, deletion }).eligible,
      ).toBe(false);
    }
  });

  test("the move defaults to revoke and accepts only revoke or keep", () => {
    const valid = {
      baseRevision: 1,
      clientIdempotencyKey: "k",
      projectId: "p",
      recordId: "r",
      recordKind: "Risk",
    };

    expect(moveToTrashInputSchema.parse(valid).surfaceDisposition).toBe(
      "revoke",
    );
    expect(
      moveToTrashInputSchema.safeParse({ ...valid, surfaceDisposition: "keep" })
        .success,
    ).toBe(true);
    expect(
      moveToTrashInputSchema.safeParse({ ...valid, surfaceDisposition: "x" })
        .success,
    ).toBe(false);
  });
});
