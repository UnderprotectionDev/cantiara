import {
  exportManifestValidation,
  type SchemaArtifactsAccess,
  type SchemaDdlPreview,
  type SchemaVersionReference,
  sqlFileName,
} from "@cantiara/api/schema-artifacts";
import { generateDdl } from "@cantiara/api/schema-ddl";
import {
  fromDataModel,
  type SchemaDefinition,
  schemaModelHash,
} from "@cantiara/api/schema-definition";
import {
  type DisposableDatabasePort,
  validateStatically,
} from "@cantiara/api/schema-static-validation";
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
): Pick<SchemaArtifactsAccess, "previewDdl"> {
  const definitionOf = dependencies.definitionOf ?? dataModelDefinition;
  return {
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
