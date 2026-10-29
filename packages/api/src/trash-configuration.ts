import { z } from "zod";

/**
 * Configuration Trash (spec 77): project-scoped definitions that share the
 * Trash seam's 30-day move, restore and expiry rules. A trashed definition
 * does not run. Restore keeps the same internal identity; a dependency that
 * was permanently deleted, is itself in Trash or changed meaning is previewed
 * as a conflict and never rebound or reminted. This is neither Archive nor a
 * restore point. Named views and priority criteria keep their own paths (a
 * view travels with its Smart Collection; priority criteria have their own
 * Trash path) and are later adapters.
 */

export const TRASH_CONFIGURATION_KINDS = [
  "Custom Field",
  "Smart Collection",
  "Automation Rule",
  "Work Template",
  "Document Template",
  "Record Action",
  "Prioritization Session",
] as const;
export const trashConfigurationKindSchema = z.enum(TRASH_CONFIGURATION_KINDS);
export type TrashConfigurationKind = z.infer<
  typeof trashConfigurationKindSchema
>;

export function isTrashConfigurationKind(
  value: string,
): value is TrashConfigurationKind {
  return (TRASH_CONFIGURATION_KINDS as readonly string[]).includes(value);
}

/** Labels of the preview and conflict sections, kept in one place for UI and tests. */
export const TRASH_AFFECTED_VALUES_LABEL = "Affected stored values";
export const TRASH_DEPENDENTS_LABEL = "Dependent views, rules and references";
export const TRASH_RESTORE_CONFLICTS_LABEL = "Restore conflicts";

/** One kind of stored value the definition owns, counted (never the values). */
export interface TrashAffectedValue {
  count: number;
  label: string;
}

/** A living definition that refers to the one moving to Trash. */
export interface TrashDependent {
  id: string;
  kind: string;
  label: string;
}

export interface TrashConfigurationImpact {
  dependents: TrashDependent[];
  storedValues: TrashAffectedValue[];
}

export const TRASH_CONFLICT_REASONS = [
  "Permanently deleted",
  "In Trash",
  "Meaning changed",
] as const;
export type TrashConflictReason = (typeof TRASH_CONFLICT_REASONS)[number];

export interface TrashRestoreConflict {
  dependencyId: string;
  dependencyKind: string;
  label: string;
  reason: TrashConflictReason;
}

export interface TrashRestorePreview {
  conflicts: TrashRestoreConflict[];
  entryId: string;
  /** `false` while any conflict remains; the restore is then refused. */
  restorable: boolean;
}

export class TrashRestoreConflictError extends Error {
  readonly code = "TRASH_RESTORE_CONFLICT" as const;
  readonly conflicts: TrashRestoreConflict[];

  constructor(conflicts: TrashRestoreConflict[]) {
    super(
      `Restore needs a decision: ${conflicts.length} dependency conflict(s). Nothing was rebound.`,
    );
    this.name = "TrashRestoreConflictError";
    this.conflicts = conflicts;
  }
}

export const trashRestorePreviewInputSchema = z
  .object({
    entryId: z.string().trim().min(1).max(255),
    projectId: z.string().trim().min(1).max(255),
  })
  .strict();
export type TrashRestorePreviewInput = z.infer<
  typeof trashRestorePreviewInputSchema
>;

const FIELD_VALUE_KIND_TYPE: Record<string, string> = {
  boolean: "Boolean",
  date: "Date",
  number: "Number",
  option: "Single select",
  options: "Multi select",
  text: "Text",
};

/**
 * Does a stored default for a custom field still mean what it meant? The type
 * must match and a chosen option must still exist. Pure so the preview and
 * the restore decide the same way.
 */
export function customFieldValueStillMeaningful(
  field: { options: readonly string[]; type: string },
  value: { kind: string; option?: string; options?: readonly string[] },
): boolean {
  if (FIELD_VALUE_KIND_TYPE[value.kind] !== field.type) {
    return false;
  }
  if (value.kind === "option") {
    return value.option !== undefined && field.options.includes(value.option);
  }
  if (value.kind === "options") {
    return (value.options ?? []).every((option) =>
      field.options.includes(option),
    );
  }
  return true;
}
