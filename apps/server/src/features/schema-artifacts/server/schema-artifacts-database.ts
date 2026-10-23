import type {
  ArtifactOperation,
  MigrationArtifact,
  MigrationWarningManifest,
} from "@cantiara/api/schema-migration-artifact";
import type { StaticValidation } from "@cantiara/api/schema-static-validation";
import type { UpEditDiff } from "@cantiara/api/schema-up-edit";
import type { Database } from "@cantiara/db";
import { migrationArtifact } from "@cantiara/db/schema/schema-artifact";
import { and, asc, eq } from "drizzle-orm";

/** Append-only storage: there is no update or delete path. */
export interface MigrationArtifactStore {
  find: (
    accountId: string,
    artifactId: string,
  ) => Promise<MigrationArtifact | null>;
  findByKey: (
    accountId: string,
    key: string,
  ) => Promise<MigrationArtifact | null>;
  /** Inserts once; a lost concurrent insert returns the existing row. */
  insert: (
    accountId: string,
    key: string,
    artifact: MigrationArtifact,
  ) => Promise<MigrationArtifact>;
  list: (accountId: string, diagramId: string) => Promise<MigrationArtifact[]>;
}

type Row = typeof migrationArtifact.$inferSelect;

function toArtifact(row: Row): MigrationArtifact {
  const reference = (versionId: string, modelHash: string) => ({
    modelHash,
    versionId,
  });
  const stored = row.operations as {
    operations: ArtifactOperation[];
    source: MigrationArtifact["source"];
    target: MigrationArtifact["target"];
  };
  return {
    createdAt: row.createdAt.toISOString(),
    diagramId: row.diagramId,
    digest: row.digest,
    downSql: row.downSql,
    editDiff: row.editDiff as UpEditDiff,
    generatorVersion: row.generatorVersion,
    id: row.id,
    operations: stored.operations,
    source: {
      ...stored.source,
      ...reference(row.sourceVersionId, row.sourceModelHash),
    },
    staticValidation: row.staticValidation as Extract<
      StaticValidation,
      { ok: true }
    >,
    supersedes: row.supersedesArtifactId,
    target: {
      ...stored.target,
      ...reference(row.targetVersionId, row.targetModelHash),
    },
    upSql: row.upSql,
    warningManifest: row.warningManifest as MigrationWarningManifest,
  };
}

export function createDatabaseMigrationArtifacts(
  db: Database,
): MigrationArtifactStore {
  const byKey = async (accountId: string, key: string) => {
    const [row] = await db
      .select()
      .from(migrationArtifact)
      .where(
        and(
          eq(migrationArtifact.accountId, accountId),
          eq(migrationArtifact.clientIdempotencyKey, key),
        ),
      );
    return row ? toArtifact(row) : null;
  };
  return {
    async find(accountId, artifactId) {
      const [row] = await db
        .select()
        .from(migrationArtifact)
        .where(
          and(
            eq(migrationArtifact.accountId, accountId),
            eq(migrationArtifact.id, artifactId),
          ),
        );
      return row ? toArtifact(row) : null;
    },
    findByKey: byKey,
    async insert(accountId, key, artifact) {
      await db
        .insert(migrationArtifact)
        .values({
          accountId,
          clientIdempotencyKey: key,
          diagramId: artifact.diagramId,
          digest: artifact.digest,
          downSql: artifact.downSql,
          editDiff: artifact.editDiff,
          generatorVersion: artifact.generatorVersion,
          id: artifact.id,
          operations: {
            operations: artifact.operations,
            source: {
              diagramId: artifact.source.diagramId,
              name: artifact.source.name,
              number: artifact.source.number,
            },
            target: {
              diagramId: artifact.target.diagramId,
              name: artifact.target.name,
              number: artifact.target.number,
            },
          },
          sourceModelHash: artifact.source.modelHash,
          sourceVersionId: artifact.source.versionId,
          staticValidation: artifact.staticValidation,
          supersedesArtifactId: artifact.supersedes,
          targetModelHash: artifact.target.modelHash,
          targetVersionId: artifact.target.versionId,
          upSql: artifact.upSql,
          warningManifest: artifact.warningManifest,
        })
        .onConflictDoNothing();
      return (await byKey(accountId, key)) ?? artifact;
    },
    async list(accountId, diagramId) {
      const rows = await db
        .select()
        .from(migrationArtifact)
        .where(
          and(
            eq(migrationArtifact.accountId, accountId),
            eq(migrationArtifact.diagramId, diagramId),
          ),
        )
        .orderBy(asc(migrationArtifact.createdAt), asc(migrationArtifact.id));
      return rows.map(toArtifact);
    },
  };
}
