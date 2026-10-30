import {
  type ImportCatalogType,
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
