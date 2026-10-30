import {
  type ImportCatalogType,
  type ImportPreview,
  type ImportScope,
  type PreviewImportInput,
  previewImportInputSchema,
} from "@cantiara/api/data-import";

export const WIKI_SCOPE = "wiki";
export const WORKSPACE_SCOPE = "workspace";
const PROJECT_SCOPE_PREFIX = "project:";

export const IMPORT_FILE_ACCEPT = ".md,.markdown,.csv,.json";

export function projectScopeValue(projectId: string) {
  return `${PROJECT_SCOPE_PREFIX}${projectId}`;
}

/** Turns the select's value back into the contract's scope. */
export function scopeOfChoice(choice: string): ImportScope | null {
  if (choice === WIKI_SCOPE) {
    return { kind: "wiki" };
  }
  if (choice === WORKSPACE_SCOPE) {
    return { kind: "workspace" };
  }
  if (choice.startsWith(PROJECT_SCOPE_PREFIX)) {
    const projectId = choice.slice(PROJECT_SCOPE_PREFIX.length);
    return projectId ? { kind: "project", projectId } : null;
  }
  return null;
}

/** Builds the preview request, or the first thing the founder must fix. */
export function buildPreviewInput(values: {
  catalogType: ImportCatalogType | "";
  content: string;
  fileCount: number;
  fileName: string;
  scopeChoice: string;
}) {
  const scope = scopeOfChoice(values.scopeChoice);
  if (!scope) {
    return { error: "Choose where to import." } as const;
  }
  const parsed = previewImportInputSchema.safeParse({
    catalogType: values.catalogType === "" ? undefined : values.catalogType,
    content: values.content,
    fileCount: values.fileCount,
    fileName: values.fileName,
    scope,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the import.",
    } as const;
  }
  return { input: parsed.data as PreviewImportInput } as const;
}

/** The refusal's explanation; it never carries file content. */
export function importErrorText(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The file could not be previewed. Try again.";
}

/** A fresh idempotency key per confirmed preview; a retry reuses it. */
export function newApplyKey() {
  return `import-${crypto.randomUUID()}`;
}

const LAST_APPLY_KEY_STORAGE_KEY = "cantiara:data-import:last-apply-key";

/** Stores the key of the last Apply Import so a fresh page can reopen its receipt. */
export function rememberLastApplyKey(idempotencyKey: string) {
  try {
    window.localStorage.setItem(LAST_APPLY_KEY_STORAGE_KEY, idempotencyKey);
  } catch {
    // A restricted browser storage context should not block Apply Import.
  }
}

/** The key of the last Apply Import, or null when none was confirmed yet. */
export function lastApplyKey() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(LAST_APPLY_KEY_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Why Apply Import cannot run on this preview yet, or null. */
export function applyBlockedReason(preview: ImportPreview) {
  if (preview.invalidTotal > 0) {
    return `${preview.invalidTotal} invalid row${preview.invalidTotal === 1 ? "" : "s"} must be corrected in the file or dropped with Exclude row before you apply.`;
  }
  if (preview.counts.create + preview.counts.updateExisting === 0) {
    return "The final set has no row to write.";
  }
  return null;
}

/** The excluded row numbers after one row is dropped or taken back. */
export function toggleExcludedRow(
  excluded: readonly number[],
  rowNumber: number,
) {
  return excluded.includes(rowNumber)
    ? excluded.filter((row) => row !== rowNumber)
    : [...excluded, rowNumber].sort((a, b) => a - b);
}
