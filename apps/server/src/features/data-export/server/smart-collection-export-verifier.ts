import type { SmartCollectionsAccess } from "@cantiara/api/smart-collections";

import type { ExportViewVerifier } from "./export-view-verification";

/**
 * Resolves a Smart Collection view through the smart-collections feature,
 * read-only, so the export manifest only claims a collection the server read:
 * its stored scope and conditions, and its live membership.
 */
export function createSmartCollectionExportVerifier(
  collections: Pick<SmartCollectionsAccess, "getView">,
): ExportViewVerifier {
  return {
    async smartCollection(accountId, viewId) {
      const view = await collections.getView(accountId, viewId, {
        readOnly: true,
      });
      if (!view) {
        return null;
      }
      const conditions: Record<string, string> = {};
      for (const [key, value] of Object.entries(view.conditions)) {
        if (typeof value === "string" && value.length > 0) {
          conditions[key] = value;
        }
      }
      return {
        conditions,
        memberIds:
          view.sourceType === "Work"
            ? view.works.map(({ id }) => id)
            : view.projectSourceRecords.map(({ id }) => id),
        name: view.collectionName,
        projectIds: view.scope.projectIds,
        sourceType: view.sourceType,
      };
    },
  };
}
