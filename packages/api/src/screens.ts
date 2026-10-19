import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);
const revisionSchema = z.number().int().nonnegative().safe();
const timestampSchema = z.string().datetime({ offset: true });

/** Common master-record visibility of a Screen; a Wireframe has none of its own. */
export const SCREEN_LIFECYCLES = ["Active", "Archived", "In Trash"] as const;
export const screenLifecycleSchema = z.enum(SCREEN_LIFECYCLES);
export type ScreenLifecycle = z.infer<typeof screenLifecycleSchema>;

export const screenTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(255, "Title must be 255 characters or fewer.");

/**
 * A Screen is created from a title alone. `.strict()` rejects a Wireframe,
 * document, visual design or file, so create can never require or smuggle one.
 */
export const createScreenInputSchema = z
  .object({ projectId: identifierSchema, title: screenTitleSchema })
  .strict();

export type CreateScreenInput = z.input<typeof createScreenInputSchema>;
export type ParsedCreateScreenInput = z.output<typeof createScreenInputSchema>;

export const SCREEN_LIFECYCLE_ACTIONS = [
  "archive",
  "unarchive",
  "trash",
  "restore",
] as const;
export const screenLifecycleActionSchema = z.enum(SCREEN_LIFECYCLE_ACTIONS);
export type ScreenLifecycleAction = z.infer<typeof screenLifecycleActionSchema>;

export const SCREEN_LIFECYCLE_ACTION_LABELS: Record<
  ScreenLifecycleAction,
  string
> = {
  archive: "Archive",
  restore: "Restore",
  trash: "Move to Trash",
  unarchive: "Unarchive",
};

/** The command names a Screen; there is no Wireframe id it could address. */
export const setScreenLifecycleInputSchema = z
  .object({
    action: screenLifecycleActionSchema,
    expectedRevision: revisionSchema.optional(),
    projectId: identifierSchema,
    screenId: identifierSchema,
  })
  .strict();

export type SetScreenLifecycleInput = z.input<
  typeof setScreenLifecycleInputSchema
>;
export type ParsedSetScreenLifecycleInput = z.output<
  typeof setScreenLifecycleInputSchema
>;

export const screenProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const resolveScreenInputSchema = z
  .object({ projectId: identifierSchema, screenId: identifierSchema })
  .strict();

export type ResolveScreenInput = z.input<typeof resolveScreenInputSchema>;

/** One exact Wireframe version; it belongs to a Screen and has no lifecycle. */
export const screenWireframeVersionSchema = z
  .object({
    createdAt: timestampSchema,
    id: identifierSchema,
    version: z.number().int().min(1).safe(),
  })
  .strict();

export type ScreenWireframeVersion = z.infer<
  typeof screenWireframeVersionSchema
>;

export const screenRecordSchema = z
  .object({
    createdAt: timestampSchema,
    id: identifierSchema,
    lifecycle: screenLifecycleSchema,
    projectId: identifierSchema,
    revision: z.number().int().min(1).safe(),
    title: screenTitleSchema,
    updatedAt: timestampSchema,
    wireframeVersions: z.array(screenWireframeVersionSchema),
  })
  .strict();

export type ScreenRecord = z.infer<typeof screenRecordSchema>;

export const screenListSchema = z
  .object({ readOnly: z.boolean(), screens: z.array(screenRecordSchema) })
  .strict();

export type ScreenList = z.infer<typeof screenListSchema>;

/** Broken-reference reasons from the PRD 02 term table that apply to a Screen. */
export const SCREEN_BROKEN_REASONS = ["In Trash", "No access"] as const;
export type ScreenBrokenReason = (typeof SCREEN_BROKEN_REASONS)[number];

/**
 * What another surface (User Flow, links) sees when it follows a Screen id.
 * A broken target carries a reason and the id it was asked for, never a title
 * or any other Screen, so nothing can be silently retargeted.
 */
export type ScreenTarget =
  | {
      lifecycle: Exclude<ScreenLifecycle, "In Trash">;
      screenId: string;
      state: "resolved";
      title: string;
    }
  | { reason: ScreenBrokenReason; screenId: string; state: "broken" };

export function screenLifecycleOf(row: {
  archivedAt: Date | string | null;
  trashedAt: Date | string | null;
}): ScreenLifecycle {
  if (row.trashedAt !== null) {
    return "In Trash";
  }
  return row.archivedAt === null ? "Active" : "Archived";
}

/**
 * Resolves exactly the requested Screen. A Screen in Trash or one that is
 * missing or not accessible is broken; the lookup never substitutes another.
 */
export function resolveScreenTarget(
  screenId: string,
  record: Pick<ScreenRecord, "id" | "lifecycle" | "title"> | null,
): ScreenTarget {
  if (!record || record.id !== screenId) {
    return { reason: "No access", screenId, state: "broken" };
  }
  if (record.lifecycle === "In Trash") {
    return { reason: "In Trash", screenId, state: "broken" };
  }
  return {
    lifecycle: record.lifecycle,
    screenId,
    state: "resolved",
    title: record.title,
  };
}

/**
 * Archive, Trash and Restore are independent flags, as for other master
 * records: Move to Trash keeps an Archive, Restore leaves it, and Unarchive is
 * refused while in Trash. A repeated command is a no-op, not a new revision.
 * Returns `null` when the action is not valid for the current visibility.
 */
export function planScreenLifecycle(
  current: { archived: boolean; trashed: boolean },
  action: ScreenLifecycleAction,
): { archived: boolean; trashed: boolean; changed: boolean } | null {
  switch (action) {
    case "archive":
      if (current.trashed) {
        return null;
      }
      return { ...current, archived: true, changed: !current.archived };
    case "unarchive":
      if (current.trashed) {
        return null;
      }
      return { ...current, archived: false, changed: current.archived };
    case "trash":
      return { ...current, changed: !current.trashed, trashed: true };
    case "restore":
      return { ...current, changed: current.trashed, trashed: false };
    default:
      return null;
  }
}

export interface ScreenStore {
  /** Attaches the next exact Wireframe version to a Screen; used by the Wireframe engine. */
  attachWireframeVersion: (
    accountId: string,
    projectId: string,
    screenId: string,
  ) => Promise<ScreenRecord | null>;
  create: (
    accountId: string,
    input: ParsedCreateScreenInput,
  ) => Promise<ScreenRecord | null>;
  find: (
    accountId: string,
    projectId: string,
    screenId: string,
  ) => Promise<ScreenRecord | null>;
  list: (accountId: string, projectId: string) => Promise<ScreenList | null>;
  setLifecycle: (
    accountId: string,
    input: ParsedSetScreenLifecycleInput,
  ) => Promise<ScreenRecord | null>;
}

export interface ScreensAccess {
  attachWireframeVersion: (
    accountId: string,
    projectId: string,
    screenId: string,
  ) => Promise<ScreenRecord>;
  create: (
    accountId: string,
    input: CreateScreenInput,
  ) => Promise<ScreenRecord>;
  list: (accountId: string, projectId: string) => Promise<ScreenList>;
  resolveTarget: (
    accountId: string,
    input: ResolveScreenInput,
  ) => Promise<ScreenTarget>;
  setLifecycle: (
    accountId: string,
    input: SetScreenLifecycleInput,
  ) => Promise<ScreenRecord>;
}
