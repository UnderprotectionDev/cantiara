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
  type DisposableDatabasePort,
  validateStatically,
} from "@cantiara/api/schema-static-validation";
import { checkUpEdit, diffUpEdit } from "@cantiara/api/schema-up-edit";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import type { DataModelModel } from "@cantiara/db/schema/technical-diagram";

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

/** Preview, validate and export the DDL of one exact Data Model version. */
export function createSchemaArtifacts(
  dependencies: SchemaArtifactDependencies,
): Pick<SchemaArtifactsAccess, "previewChange" | "previewDdl"> {
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

  return {
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
}
