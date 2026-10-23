import {
  exportManifestValidation,
  SchemaArtifactError,
  type SchemaArtifactsAccess,
  type SchemaChangePreview,
  type SchemaDdlPreview,
  type SchemaVersionReference,
  sqlFileName,
} from "@cantiara/api/schema-artifacts";
import {
  buildSchemaChangeDraft,
  destructiveOperations,
} from "@cantiara/api/schema-change-draft";
import { generateDdl } from "@cantiara/api/schema-ddl";
import {
  fromDataModel,
  SCHEMA_GENERATOR_VERSION,
  type SchemaDefinition,
  schemaModelHash,
} from "@cantiara/api/schema-definition";
import {
  confirmMigrationArtifactInputSchema,
  exportMigrationArtifact,
  type MigrationArtifact,
  migrationArtifactDigest,
} from "@cantiara/api/schema-migration-artifact";
import { buildSafeDown } from "@cantiara/api/schema-safe-down";
import {
  type DisposableDatabasePort,
  validateStatically,
} from "@cantiara/api/schema-static-validation";
import { checkUpEdit, diffUpEdit } from "@cantiara/api/schema-up-edit";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import type { DataModelModel } from "@cantiara/db/schema/technical-diagram";
import type { MigrationArtifactStore } from "./schema-artifacts-database";

export interface SchemaArtifactVersions {
  getVersion: (
    accountId: string,
    versionId: string,
  ) => Promise<TechnicalDiagramVersion | null>;
}

export interface SchemaArtifactDependencies {
  /**
   * Reads the Schema Definition of one exact version. The default maps the
   * spec 59 Data Model; tests may fixture a richer definition at this seam.
   */
  definitionOf?: (version: TechnicalDiagramVersion) => SchemaDefinition | null;
  newId?: () => string;
  now?: () => Date;
  /** Append-only artifact storage; absent in DDL-only wiring. */
  store?: MigrationArtifactStore;
  /** Undefined when no disposable validation database is configured. */
  validator?: DisposableDatabasePort;
  versions: SchemaArtifactVersions;
}

export function dataModelDefinition(
  version: TechnicalDiagramVersion,
): SchemaDefinition | null {
  return version.type === "Data Model"
    ? fromDataModel(version.model as DataModelModel)
    : null;
}

export function versionReference(
  version: TechnicalDiagramVersion,
): SchemaVersionReference {
  return {
    diagramId: version.diagramId,
    name: version.name,
    number: version.number,
    versionId: version.id,
  };
}

/** Preview, validate, confirm and export Schema Artifacts of exact Data Model versions. */
export function createSchemaArtifacts(
  dependencies: SchemaArtifactDependencies,
): SchemaArtifactsAccess {
  const definitionOf = dependencies.definitionOf ?? dataModelDefinition;
  async function pinnedVersions(
    accountId: string,
    sourceVersionId: string,
    targetVersionId: string,
  ) {
    const [source, target] = await Promise.all([
      dependencies.versions.getVersion(accountId, sourceVersionId),
      dependencies.versions.getVersion(accountId, targetVersionId),
    ]);
    const from = source && definitionOf(source);
    const to = target && definitionOf(target);
    if (!(source && target && from && to)) {
      return null;
    }
    if (source.diagramId !== target.diagramId || source.id === target.id) {
      throw new SchemaArtifactError(
        "Choose two different Diagram Versions of the same Data Model Diagram.",
      );
    }
    return { from, source, target, to };
  }

  const { store } = dependencies;
  const newId = dependencies.newId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  const access: SchemaArtifactsAccess = {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: A flat list of confirmation rules, each one a named refusal.
    async confirmArtifact(accountId, rawInput) {
      const input = confirmMigrationArtifactInputSchema.parse(rawInput);
      if (!store) {
        throw new SchemaArtifactError(
          "Migration Artifact storage is unavailable.",
        );
      }
      const existing = await store.findByKey(
        accountId,
        input.clientIdempotencyKey,
      );
      if (existing) {
        return existing;
      }
      const pinned = await pinnedVersions(
        accountId,
        input.sourceVersionId,
        input.targetVersionId,
      );
      if (!pinned) {
        return null;
      }
      const draft = buildSchemaChangeDraft(pinned.from, pinned.to);
      if (draft.violations.length > 0 || draft.blockers.length > 0) {
        throw new SchemaArtifactError(
          "A blocked Schema Change Draft cannot become a Migration Artifact.",
        );
      }
      if (draft.operations.length === 0) {
        throw new SchemaArtifactError(
          "The two Diagram Versions have no schema difference.",
        );
      }
      const destructive = destructiveOperations(draft).map(({ id }) => id);
      const confirmed = new Set(input.confirmedDestructiveOperationIds);
      if (
        destructive.some((id) => !confirmed.has(id)) ||
        [...confirmed].some((id) => !destructive.includes(id))
      ) {
        throw new SchemaArtifactError(
          "Confirm every potentially destructive operation, and only those.",
        );
      }
      const upSql = input.editedUpSql ?? draft.upSql;
      if (upSql === "") {
        throw new SchemaArtifactError(
          "The two Diagram Versions have no schema difference.",
        );
      }
      if (upSql !== draft.upSql && checkUpEdit(upSql).length > 0) {
        throw new SchemaArtifactError(
          "The edited Up text leaves the operation catalog.",
        );
      }
      const down = buildSafeDown(draft, { edited: upSql !== draft.upSql });
      const sourceDdl = await generateDdl(pinned.from);
      if (!sourceDdl.ok) {
        throw new SchemaArtifactError(
          "The source version fails its invariants.",
        );
      }
      const validation = await validateStatically(dependencies.validator, [
        sourceDdl.sql,
        upSql,
        ...(down.status === "Produced" ? [down.sql] : []),
      ]);
      if (!validation.ok) {
        throw new SchemaArtifactError(
          `Not Statically Validated: ${validation.detail}`,
        );
      }
      if (input.supersedes) {
        const earlier = await store.find(accountId, input.supersedes);
        if (!earlier || earlier.diagramId !== pinned.source.diagramId) {
          throw new SchemaArtifactError(
            "Supersedes Migration Artifact must be an artifact of the same Data Model Diagram.",
          );
        }
      }
      const [sourceHash, targetHash] = await Promise.all([
        schemaModelHash(pinned.from),
        schemaModelHash(pinned.to),
      ]);
      const operations = draft.operations.map(
        ({ class: kind, id, operation, path }) => ({
          class: kind,
          id,
          operation,
          path,
        }),
      );
      const downSql = down.status === "Produced" ? down.sql : null;
      const artifact: MigrationArtifact = {
        createdAt: now().toISOString(),
        diagramId: pinned.source.diagramId,
        digest: await migrationArtifactDigest({
          downSql,
          generatorVersion: SCHEMA_GENERATOR_VERSION,
          operations,
          sourceModelHash: sourceHash,
          targetModelHash: targetHash,
          upSql,
        }),
        downSql,
        editDiff: diffUpEdit(draft.upSql, upSql),
        generatorVersion: SCHEMA_GENERATOR_VERSION,
        id: newId(),
        operations,
        source: { ...versionReference(pinned.source), modelHash: sourceHash },
        staticValidation: validation,
        supersedes: input.supersedes,
        target: { ...versionReference(pinned.target), modelHash: targetHash },
        upSql,
        warningManifest: {
          confirmedDestructive: destructive,
          down: down.status === "Unavailable" ? down : null,
          warnings: draft.warnings,
        },
      };
      return store.insert(accountId, input.clientIdempotencyKey, artifact);
    },
    async exportArtifact(accountId, artifactId) {
      const artifact = await store?.find(accountId, artifactId);
      return artifact ? exportMigrationArtifact(artifact) : null;
    },
    getArtifact: (accountId, artifactId) =>
      store?.find(accountId, artifactId) ?? Promise.resolve(null),
    listArtifacts: (accountId, diagramId) =>
      store?.list(accountId, diagramId) ?? Promise.resolve([]),
    async previewChange(accountId, input): Promise<SchemaChangePreview | null> {
      const pinned = await pinnedVersions(
        accountId,
        input.sourceVersionId,
        input.targetVersionId,
      );
      if (!pinned) {
        return null;
      }
      const { from, source, target, to } = pinned;
      const draft = buildSchemaChangeDraft(from, to);
      const sourceReference = versionReference(source);
      const targetReference = versionReference(target);
      if (draft.violations.length > 0 || draft.blockers.length > 0) {
        return {
          blockers: draft.blockers,
          source: sourceReference,
          status: "Blocked",
          target: targetReference,
          violations: draft.violations,
        };
      }
      const [sourceDdl, sourceHash, targetHash] = await Promise.all([
        generateDdl(from),
        schemaModelHash(from),
        schemaModelHash(to),
      ]);
      const upSql = input.editedUpSql ?? draft.upSql;
      const issues = upSql === draft.upSql ? [] : checkUpEdit(upSql);
      const validation =
        issues.length > 0 || !sourceDdl.ok || upSql === ""
          ? null
          : await validateStatically(dependencies.validator, [
              sourceDdl.sql,
              upSql,
            ]);
      const destructive = destructiveOperations(draft);
      let confirmBlockedBy: string | null = null;
      if (draft.operations.length === 0 || upSql === "") {
        confirmBlockedBy =
          "The two Diagram Versions have no schema difference.";
      } else if (issues.length > 0) {
        confirmBlockedBy = "The edited Up text leaves the operation catalog.";
      } else if (!validation?.ok) {
        confirmBlockedBy = "The Up text is not Statically Validated.";
      }
      return {
        confirmBlockedBy,
        confirmable: confirmBlockedBy === null,
        destructiveOperationIds: destructive.map(({ id }) => id),
        down: buildSafeDown(draft, { edited: upSql !== draft.upSql }),
        edit: { diff: diffUpEdit(draft.upSql, upSql), issues },
        generatedUpSql: draft.upSql,
        generatorVersion: SCHEMA_GENERATOR_VERSION,
        operations: draft.operations.map((operation) => ({
          class: operation.class,
          id: operation.id,
          operation: operation.operation,
          path: operation.path,
          sql: operation.statements.map(({ sql }) => sql),
          warnings: operation.warnings,
        })),
        requiresDestructiveConfirmation: destructive.length > 0,
        source: { ...sourceReference, modelHash: sourceHash },
        status: "Ready",
        target: { ...targetReference, modelHash: targetHash },
        upSql,
        validation,
        warnings: draft.warnings,
      };
    },
    async previewDdl(accountId, input): Promise<SchemaDdlPreview | null> {
      const version = await dependencies.versions.getVersion(
        accountId,
        input.versionId,
      );
      const definition = version && definitionOf(version);
      if (!(version && definition)) {
        return null;
      }
      const reference = versionReference(version);
      const ddl = await generateDdl(definition);
      if (!ddl.ok) {
        return {
          modelHash: await schemaModelHash(definition),
          status: "Blocked",
          version: reference,
          violations: ddl.violations,
        };
      }
      const validation = await validateStatically(dependencies.validator, [
        ddl.sql,
      ]);
      return {
        export: validation.ok
          ? {
              filename: sqlFileName(reference, "ddl.sql"),
              manifest: {
                generatorVersion: ddl.generatorVersion,
                kind: "PostgreSQL DDL",
                staticValidation: exportManifestValidation(validation),
                versions: [{ ...reference, modelHash: ddl.modelHash }],
                warnings: ddl.warnings,
              },
              manifestFilename: sqlFileName(reference, "ddl.manifest.json"),
              sql: ddl.sql,
            }
          : null,
        generatorVersion: ddl.generatorVersion,
        modelHash: ddl.modelHash,
        sql: ddl.sql,
        status: "Ready",
        validation,
        version: reference,
        warnings: ddl.warnings,
      };
    },
  };
  return access;
}
