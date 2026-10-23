import { z } from "zod";
import type {
  SchemaExportManifest,
  SchemaSqlExport,
  SchemaVersionPin,
} from "./schema-artifacts";
import { exportManifestValidation, sqlFileName } from "./schema-artifacts";
import type {
  OperationClass,
  SchemaOperationName,
} from "./schema-change-draft";
import type { SchemaWarning } from "./schema-ddl";
import { sha256Hex } from "./schema-definition";
import type { SafeDown } from "./schema-safe-down";
import type { StaticValidation } from "./schema-static-validation";
import type { UpEditDiff } from "./schema-up-edit";

/** Typed, identified operation of the confirmed plan; layout never appears here. */
export interface ArtifactOperation {
  class: OperationClass;
  id: string;
  operation: SchemaOperationName;
  path: string;
}

export interface MigrationWarningManifest {
  /** Destructive operations the user explicitly confirmed. */
  confirmedDestructive: string[];
  /** Why Down is absent, with the operation that dropped it; null when produced. */
  down: Extract<SafeDown, { status: "Unavailable" }> | null;
  warnings: SchemaWarning[];
}

/**
 * Immutable Migration Artifact. It owns no applied state: nothing here says
 * the SQL ran anywhere, and no field is ever updated after the insert.
 */
export interface MigrationArtifact {
  createdAt: string;
  diagramId: string;
  digest: string;
  downSql: string | null;
  editDiff: UpEditDiff;
  generatorVersion: string;
  id: string;
  operations: ArtifactOperation[];
  source: SchemaVersionPin;
  staticValidation: Extract<StaticValidation, { ok: true }>;
  /** Earlier artifact this one corrects; never inherits its evidence. */
  supersedes: string | null;
  target: SchemaVersionPin;
  upSql: string;
  warningManifest: MigrationWarningManifest;
}

export const confirmMigrationArtifactInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    confirmedDestructiveOperationIds: z.array(z.string().min(1)).default([]),
    editedUpSql: z.string().max(500_000).nullable().default(null),
    sourceVersionId: z.string().min(1),
    supersedes: z.string().min(1).nullable().default(null),
    targetVersionId: z.string().min(1),
  })
  .strict();
export type ConfirmMigrationArtifactInput = z.infer<
  typeof confirmMigrationArtifactInputSchema
>;

export const migrationArtifactListInputSchema = z
  .object({ diagramId: z.string().min(1) })
  .strict();
export const migrationArtifactInputSchema = z
  .object({ artifactId: z.string().min(1) })
  .strict();

/**
 * `Migration Artifact Digest`: binds the source and target model hashes, the
 * identified operation plan, the generator version and the exact Up and Down
 * bytes. Presentation layout is not an input, so only a byte or an operation
 * difference changes it.
 */
export function migrationArtifactDigest(parts: {
  downSql: string | null;
  generatorVersion: string;
  operations: ArtifactOperation[];
  sourceModelHash: string;
  targetModelHash: string;
  upSql: string;
}): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      downSql: parts.downSql,
      generatorVersion: parts.generatorVersion,
      kind: "Migration Artifact Digest",
      operations: parts.operations.map(
        ({ class: kind, id, operation, path }) => [id, operation, kind, path],
      ),
      sourceModelHash: parts.sourceModelHash,
      targetModelHash: parts.targetModelHash,
      upSql: parts.upSql,
    }),
  );
}

export interface MigrationArtifactExport {
  files: SchemaSqlExport[];
}

/** `.sql` files plus the manifest; the export runs and writes nothing. */
export function exportMigrationArtifact(
  artifact: MigrationArtifact,
): MigrationArtifactExport {
  const manifest: SchemaExportManifest & {
    digest: string;
    supersedes: string | null;
  } = {
    digest: artifact.digest,
    generatorVersion: artifact.generatorVersion,
    kind: "Migration Artifact",
    staticValidation: exportManifestValidation(artifact.staticValidation),
    supersedes: artifact.supersedes,
    versions: [artifact.source, artifact.target],
    warnings: artifact.warningManifest.warnings,
  };
  const file = (suffix: string, sql: string): SchemaSqlExport => ({
    filename: sqlFileName(artifact.target, `${suffix}.sql`),
    manifest,
    manifestFilename: sqlFileName(artifact.target, `${suffix}.manifest.json`),
    sql,
  });
  return {
    files: [
      file("up", artifact.upSql),
      ...(artifact.downSql === null ? [] : [file("down", artifact.downSql)]),
    ],
  };
}
