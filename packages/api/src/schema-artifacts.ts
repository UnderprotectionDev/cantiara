import { z } from "zod";
import type { SchemaWarning } from "./schema-ddl";
import type { SchemaViolation } from "./schema-invariants";
import type { StaticValidation } from "./schema-static-validation";

/** The exact Data Model `Diagram Version` an artifact is built from. */
export interface SchemaVersionReference {
  diagramId: string;
  name: string;
  number: number;
  versionId: string;
}

export const schemaDdlPreviewInputSchema = z
  .object({ versionId: z.string().min(1) })
  .strict();
export type SchemaDdlPreviewInput = z.infer<typeof schemaDdlPreviewInputSchema>;

/**
 * Manifest that travels with a `.sql` file (PRD 13 Technical SQL output). It
 * has no applied state: the export neither runs nor claims SQL ran anywhere.
 */
export interface SchemaExportManifest {
  generatorVersion: string;
  kind: "PostgreSQL DDL" | "Migration Artifact";
  staticValidation:
    | {
        extensions: readonly string[];
        label: "Statically Validated";
        postgresMajor: number;
      }
    | { label: "Not validated" };
  versions: Array<SchemaVersionReference & { modelHash: string }>;
  warnings: SchemaWarning[];
}

export interface SchemaSqlExport {
  filename: string;
  manifest: SchemaExportManifest;
  manifestFilename: string;
  sql: string;
}

export type SchemaDdlPreview =
  | {
      /** A closed invariant failed; no SQL is shown, copied or exported. */
      modelHash: string;
      status: "Blocked";
      version: SchemaVersionReference;
      violations: SchemaViolation[];
    }
  | {
      /** Present only when the disposable validation passed. */
      export: SchemaSqlExport | null;
      generatorVersion: string;
      modelHash: string;
      sql: string;
      status: "Ready";
      validation: StaticValidation;
      version: SchemaVersionReference;
      warnings: SchemaWarning[];
    };

export function sqlFileName(
  version: SchemaVersionReference,
  suffix: string,
): string {
  const slug = version.name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  return `${slug || "schema"}-v${version.number}-${suffix}`;
}

export function exportManifestValidation(
  validation: StaticValidation,
): SchemaExportManifest["staticValidation"] {
  return validation.ok
    ? {
        extensions: validation.extensions,
        label: validation.label,
        postgresMajor: validation.postgresMajor,
      }
    : { label: "Not validated" };
}

export interface SchemaArtifactsAccess {
  /** `null` when the version is missing or is not a Data Model version. */
  previewDdl: (
    accountId: string,
    input: SchemaDdlPreviewInput,
  ) => Promise<SchemaDdlPreview | null>;
}
