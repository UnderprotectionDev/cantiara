import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * External Surface Management seam (spec 76): the founder's single directory of
 * every `Dış yüzey` — link share, Wiki publication and Build in Public — with
 * its source, visibility, access and life state. It only reads and manages
 * existing surfaces: it mints no link, no Wiki page and no Build in Public
 * enable (specs 73, 74, 75), and it collects no view count, last access,
 * visitor identity, IP profile or per-person history.
 *
 * A row never carries a Share token, a Link password, a hash of either, a
 * snapshot body or a redacted value.
 */

export const SHARES_AND_PUBLICATIONS_LABEL = "Shares and Publications";
export const ACTIVE_LABEL = "Active";
export const EXPIRED_LABEL = "Expired";
export const REVOKED_LABEL = "Revoked";
export const OPEN_SOURCE_LABEL = "Open source";
export const REVIEW_DIFF_LABEL = "Review diff";
export const CHANGE_EXPIRY_LABEL = "Change expiry / Reactivate";
export const REVOKE_UNPUBLISH_LABEL = "Revoke / Unpublish";

export const SURFACE_STATUSES = [
  ACTIVE_LABEL,
  EXPIRED_LABEL,
  REVOKED_LABEL,
] as const;
export type SurfaceStatus = (typeof SURFACE_STATUSES)[number];

/** Visibility kinds: Bağlantıyla sınırlı paylaşım, Tekil Wiki yayını, Build in Public. */
export const SURFACE_VISIBILITY_KINDS = [
  "Link",
  "Wiki",
  "Build in Public",
] as const;
export type SurfaceVisibilityKind = (typeof SURFACE_VISIBILITY_KINDS)[number];

export const SURFACE_ACTIONS = [
  OPEN_SOURCE_LABEL,
  REVIEW_DIFF_LABEL,
  CHANGE_EXPIRY_LABEL,
  REVOKE_UNPUBLISH_LABEL,
] as const;
export type SurfaceAction = (typeof SURFACE_ACTIONS)[number];

const identifier = z.string().trim().min(1).max(255);

export const listExternalSurfacesInputSchema = z
  .object({
    /** Scope to one Project's rows; omitted means the whole Çalışma Alanı. */
    projectId: identifier.optional(),
  })
  .strict();
export type ListExternalSurfacesInput = z.infer<
  typeof listExternalSurfacesInputSchema
>;

export const surfaceSourceSchema = z.object({
  id: z.string(),
  /** The kind of the source record, such as `Document` or `Project`. */
  kind: z.string(),
  projectId: z.string().nullable(),
  /** The title the founder approved, not a live read of the source. */
  title: z.string(),
});
export type SurfaceSource = z.infer<typeof surfaceSourceSchema>;

export const surfaceRowSchema = z.object({
  actions: z.array(z.enum(SURFACE_ACTIONS)),
  /** Optional Bağlantı süre dolumu as an ISO instant. */
  expiresAt: z.string().nullable(),
  /**
   * The source was trashed or removed and the surface was kept: it serves its
   * frozen Onaylı snapshot revizyonu, is not live-updating and is not `410`.
   */
  frozenDetached: z.boolean(),
  /** Whether the source changed after the last approval. */
  hasUnpublishedChanges: z.boolean(),
  lastApprovedAt: z.string().nullable(),
  /** Whether a Link password gates the surface; never the password. */
  passwordProtected: z.boolean(),
  projectId: z.string().nullable(),
  /** `Redacted` hides that the removed value ever existed here; the value is never present. */
  redaction: z.enum(["None", "Redacted"]),
  revision: z.number().int().nonnegative(),
  source: surfaceSourceSchema,
  status: z.enum(SURFACE_STATUSES),
  surfaceId: z.string(),
  visibility: z.enum(SURFACE_VISIBILITY_KINDS),
});
export type SurfaceRow = z.infer<typeof surfaceRowSchema>;

export const surfaceDirectorySchema = z.object({
  rows: z.array(surfaceRowSchema),
});
export type SurfaceDirectory = z.infer<typeof surfaceDirectorySchema>;

export interface ExternalSurfaceManagementAccess {
  /** Every Dış yüzey of the account's Çalışma Alanı (or one Project), newest approval first. */
  list: (
    accountId: string,
    input: ListExternalSurfacesInput,
  ) => Promise<SurfaceDirectory | null>;
}

export function externalSurfaceManagementUnavailable(): never {
  throw new ORPCError("NOT_FOUND");
}
