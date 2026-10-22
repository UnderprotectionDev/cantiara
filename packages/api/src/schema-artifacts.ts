import { z } from "zod";
import type {
  OperationClass,
  SchemaBlocker,
  SchemaOperationName,
} from "./schema-change-draft";
import type { SchemaWarning } from "./schema-ddl";
import type { SchemaViolation } from "./schema-invariants";
import type {
  ConfirmMigrationArtifactInput,
  MigrationArtifact,
  MigrationArtifactExport,
} from "./schema-migration-artifact";
import type { SafeDown } from "./schema-safe-down";
import type { StaticValidation } from "./schema-static-validation";
import type { UpEditDiff, UpEditIssue } from "./schema-up-edit";

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

export class SchemaArtifactError extends Error {}

export const schemaChangePreviewInputSchema = z
  .object({
    /** The user's hand-edited Up text; null keeps the generator output. */
    editedUpSql: z.string().max(500_000).nullable().default(null),
    sourceVersionId: z.string().min(1),
    targetVersionId: z.string().min(1),
  })
  .strict();
export type SchemaChangePreviewInput = z.infer<
  typeof schemaChangePreviewInputSchema
>;

export interface SchemaVersionPin extends SchemaVersionReference {
  modelHash: string;
}

export interface SchemaOperationView {
  class: OperationClass;
  id: string;
  operation: SchemaOperationName;
  path: string;
  sql: string[];
  warnings: SchemaWarning[];
}

export type SchemaChangePreview =
  | {
      /** An invariant failed or the catalog cannot express the difference. */
      blockers: SchemaBlocker[];
      source: SchemaVersionReference;
      status: "Blocked";
      target: SchemaVersionReference;
      violations: SchemaViolation[];
    }
  | {
      /** True when every check passed and the user may confirm. */
      confirmable: boolean;
      /** Why the draft cannot be confirmed yet, in plain words. */
      confirmBlockedBy: string | null;
      destructiveOperationIds: string[];
      /** Generator output and the user's edit stay apart. */
      edit: { diff: UpEditDiff; issues: UpEditIssue[] };
      generatedUpSql: string;
      generatorVersion: string;
      /** Safe Down, or the operation that dropped the whole inverse. */
      down: SafeDown;
      operations: SchemaOperationView[];
      /** Extra confirmation is required before the artifact can be minted. */
      requiresDestructiveConfirmation: boolean;
      source: SchemaVersionPin;
      status: "Ready";
      target: SchemaVersionPin;
      upSql: string;
      /** Null while the edited text itself is rejected. */
      validation: StaticValidation | null;
      warnings: SchemaWarning[];
    };

export interface SchemaArtifactsAccess {
  /**
   * Mints the immutable artifact after the matching draft re-validates. The
   * product stores and exports it; it never runs it. Idempotent by key.
   */
  confirmArtifact: (
    accountId: string,
    input: ConfirmMigrationArtifactInput,
  ) => Promise<MigrationArtifact | null>;
  exportArtifact: (
    accountId: string,
    artifactId: string,
  ) => Promise<MigrationArtifactExport | null>;
  getArtifact: (
    accountId: string,
    artifactId: string,
  ) => Promise<MigrationArtifact | null>;
  listArtifacts: (
    accountId: string,
    diagramId: string,
  ) => Promise<MigrationArtifact[]>;
  previewChange: (
    accountId: string,
    input: SchemaChangePreviewInput,
  ) => Promise<SchemaChangePreview | null>;
  /** `null` when the version is missing or is not a Data Model version. */
  previewDdl: (
    accountId: string,
    input: SchemaDdlPreviewInput,
  ) => Promise<SchemaDdlPreview | null>;
}
