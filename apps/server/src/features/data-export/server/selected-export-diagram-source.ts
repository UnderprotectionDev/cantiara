import type { ExportField } from "@cantiara/api/data-export";
import type { TechnicalDiagramsAccess } from "@cantiara/api/technical-diagrams";

import type { ExportSourceReader } from "./selected-export";
import { refuseUnsupportedFilters } from "./selected-export-database-support";

const DIAGRAM_FIELDS: ExportField[] = [
  { key: "title", label: "Title" },
  { key: "type", label: "Diagram type" },
  { key: "authorityMode", label: "Authority mode" },
  { key: "revision", label: "Revision" },
  { key: "model", label: "Structural model" },
  { key: "externalSource", label: "External source link" },
];

interface StoredExternalSource {
  lastCheckedAt: string;
  revision: string | null;
  tool: string;
  url: string;
}

/**
 * An External Source Link keeps its content in the external tool. The export
 * names the link target by exact scheme, host and path only: a query string or
 * fragment can carry a token, so neither leaves. The tool, the known revision
 * and the last check time are the link's own metadata.
 */
function exportedExternalSource(link: StoredExternalSource | null) {
  if (!link) {
    return null;
  }
  try {
    const parsed = new URL(link.url);
    return {
      lastCheckedAt: link.lastCheckedAt,
      revision: link.revision,
      tool: link.tool,
      url: `${parsed.origin}${parsed.pathname}`,
    };
  } catch {
    return null;
  }
}

/**
 * Read-only, export-only source of Technical Diagrams (spec 79 US13). One
 * record is one diagram: its structural model, authority mode, Diagram Views
 * and the manifests (never the models) of its Diagram Versions travel as owned
 * components, so a Diagram View or Diagram Version is never a record of its
 * own. The file claims no ownership of external content and no import promise.
 */
export function createDiagramExportSource(options: {
  diagrams: Pick<
    TechnicalDiagramsAccess,
    "list" | "listVersions" | "listViews"
  >;
  ownsProject: (accountId: string, projectId: string) => Promise<boolean>;
}): ExportSourceReader {
  return {
    fields: () => DIAGRAM_FIELDS,
    async read(input) {
      refuseUnsupportedFilters(input, ["versionId"]);
      if (input.scope.kind !== "project") {
        return null;
      }
      const { projectId } = input.scope;
      if (!(await options.ownsProject(input.accountId, projectId))) {
        return null;
      }
      const wanted = input.recordIds?.length ? new Set(input.recordIds) : null;
      const diagrams = (await options.diagrams.list(input.accountId, projectId))
        .filter((diagram) => !wanted || wanted.has(diagram.id))
        .slice(0, input.limit);
      const records = await Promise.all(
        diagrams.map(async (diagram) => {
          const [views, versions] = await Promise.all([
            options.diagrams.listViews(input.accountId, diagram.id),
            options.diagrams.listVersions(input.accountId, diagram.id),
          ]);
          return {
            components: {
              diagramVersions: (versions ?? [])
                .filter(
                  (version) =>
                    !input.filters.versionId ||
                    version.id === input.filters.versionId,
                )
                .map((version) => ({
                  authorityMode: version.authorityMode,
                  createdAt: version.createdAt,
                  id: version.id,
                  name: version.name,
                  number: version.number,
                  revision: version.revision,
                })),
              diagramViews: (views ?? []).map((view) => ({
                id: view.id,
                layout: view.layout,
                name: view.name,
                selectedNodeIds: view.selectedNodeIds,
              })),
            },
            id: diagram.id,
            label: diagram.title,
            values: {
              authorityMode: diagram.authorityMode,
              externalSource: exportedExternalSource(diagram.externalSource),
              model: diagram.model,
              revision: diagram.revision,
              title: diagram.title,
              type: diagram.type,
            },
          };
        }),
      );
      return { records, relations: [] };
    },
  };
}
