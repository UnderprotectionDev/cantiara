import {
  EXPORT_CATALOG,
  EXPORT_DIAGRAM_TYPE,
  EXPORT_WORK_FAMILY,
} from "@cantiara/api/data-export";
import type { SmartCollectionsAccess } from "@cantiara/api/smart-collections";
import type { TechnicalDiagramsAccess } from "@cantiara/api/technical-diagrams";
import type { Database } from "@cantiara/db";

import { csvExportProducer } from "./csv-export-producer";
import { jsonExportProducer } from "./json-export-producer";
import { createPdfExportProducer } from "./pdf-export-producer";
import { renderExportPdf } from "./pdf-export-renderer";
import { createSelectedExport } from "./selected-export";
import { ownsProject } from "./selected-export-database-support";
import { createDiagramExportSource } from "./selected-export-diagram-source";
import { createDatabaseRecordExportSources } from "./selected-export-records-database";
import { createDatabaseWorkExportSource } from "./selected-export-work-database";
import { createDatabaseWorkspaceExportSources } from "./selected-export-workspace-database";
import { createSmartCollectionExportVerifier } from "./smart-collection-export-verifier";

/**
 * The Selected Export seam over one database: every record reader, the three
 * format producers and the Smart Collection view verifier. The API server and
 * the browser-test server both compose it here so they cannot drift apart.
 */
export function createDatabaseSelectedExport(options: {
  db: Database;
  smartCollections: Pick<SmartCollectionsAccess, "getView">;
  technicalDiagrams: Pick<
    TechnicalDiagramsAccess,
    "list" | "listVersions" | "listViews"
  >;
}) {
  const { db } = options;
  // Work has its own reader; the plain project-scoped types share one factory.
  const workExportSource = createDatabaseWorkExportSource(db);
  const workExportTypes =
    EXPORT_CATALOG.find((entry) => entry.family === "Work")?.recordTypes ?? [];
  return createSelectedExport({
    producers: {
      CSV: csvExportProducer,
      JSON: jsonExportProducer,
      PDF: createPdfExportProducer({ render: renderExportPdf }),
    },
    sources: {
      ...createDatabaseRecordExportSources(db),
      ...createDatabaseWorkspaceExportSources(db),
      ...Object.fromEntries(
        [...workExportTypes, EXPORT_WORK_FAMILY].map((recordType) => [
          recordType,
          workExportSource,
        ]),
      ),
      // Export-only: a diagram is never imported as create, update or restore.
      [EXPORT_DIAGRAM_TYPE]: createDiagramExportSource({
        diagrams: options.technicalDiagrams,
        ownsProject: (accountId, projectId) =>
          ownsProject(db, accountId, projectId),
      }),
    },
    viewVerifier: createSmartCollectionExportVerifier(options.smartCollections),
  });
}
