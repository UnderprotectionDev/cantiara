import type {
  ProductGapFollowUpSource,
  ProductGapLinkTarget,
  ProductGapStore,
  ProductGapStoredRecord,
  ProductGapTargetResolver,
} from "@cantiara/api/product-gaps";

import { createProductGaps } from "./product-gaps";

export const accountId = "account-1";

export type CatalogState = "active" | "archived" | "trashed" | "gone";

export interface ProductGapCatalogEntry {
  label: string;
  /** Project only: an archived Project stays readable but takes no Work. */
  readOnly?: boolean;
  state?: CatalogState;
  targetId: string;
  targetType: "Decision" | "Feature" | "Project" | "Work";
}

/**
 * In-memory Product Gaps harness. The catalog stands in for the owner records
 * the live resolver reads. `writes` records every write the module makes to a
 * record other than a Gap, so a test can prove a status change or a similar
 * title touches no Project, Work, Feature or Decision.
 */
export function createProductGapHarness(
  entries: ProductGapCatalogEntry[] = [],
) {
  const catalog = new Map<string, ProductGapCatalogEntry>();
  const key = (type: string, id: string) => `${type}:${id}`;
  for (const entry of entries) {
    catalog.set(key(entry.targetType, entry.targetId), { ...entry });
  }
  const gaps = new Map<string, ProductGapStoredRecord>();
  const writes: string[] = [];
  const receipts = new Map<
    string,
    { fingerprint: string; workKey: string | null }
  >();
  let workCount = 0;

  const resolver: ProductGapTargetResolver = {
    bind: (link) => {
      const entry = catalog.get(key(link.targetType, link.targetId));
      return Promise.resolve(
        entry && (entry.state ?? "active") === "active"
          ? { label: entry.label }
          : null,
      );
    },
    candidates: (type) =>
      Promise.resolve(
        [...catalog.values()]
          .filter(
            (entry) =>
              entry.targetType === type &&
              (entry.state ?? "active") === "active",
          )
          .map(
            (entry): ProductGapLinkTarget => ({
              label: entry.label,
              targetId: entry.targetId,
              targetType: type,
            }),
          ),
      ),
    read: (link) => {
      const entry = catalog.get(key(link.targetType, link.targetId));
      const state = entry ? (entry.state ?? "active") : "gone";
      if (!entry || state === "gone") {
        return Promise.resolve({
          reason: "Permanently deleted" as const,
          state: "broken" as const,
        });
      }
      if (state === "trashed") {
        return Promise.resolve({
          reason: "In Trash" as const,
          state: "broken" as const,
        });
      }
      if (state === "archived") {
        return Promise.resolve({
          reason: "Archived" as const,
          state: "broken" as const,
        });
      }
      return Promise.resolve({
        label: entry.label,
        state: "resolved" as const,
      });
    },
  };

  const owned = (id: string) => id === accountId;

  function followUpSource(
    gap: ProductGapStoredRecord,
    input: Parameters<ProductGapStore["readFollowUpSource"]>[1],
  ): ProductGapFollowUpSource {
    if (input.kind === "Feature relation") {
      const feature = catalog.get(key("Feature", input.featureId));
      return {
        gap,
        target:
          feature && (feature.state ?? "active") === "active"
            ? {
                feature: { id: feature.targetId, label: feature.label },
                kind: "Feature relation",
              }
            : null,
      };
    }
    const project = catalog.get(key("Project", input.projectId));
    return {
      gap,
      target:
        project && (project.state ?? "active") !== "gone"
          ? {
              kind: "Work",
              project: {
                id: project.targetId,
                name: project.label,
                readOnly:
                  project.readOnly === true ||
                  (project.state ?? "active") !== "active",
              },
            }
          : null,
    };
  }

  const store: ProductGapStore = {
    confirmFollowUp: (account, input) => {
      const gap = gaps.get(input.gapId);
      if (!(gap && owned(account))) {
        return Promise.resolve(null);
      }
      const fingerprint = JSON.stringify(input.plan);
      const replay = receipts.get(input.clientIdempotencyKey);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return Promise.reject(new Error("Idempotency key reused."));
        }
        return Promise.resolve({
          linkId: input.id,
          workId: input.workId ?? null,
          workKey: replay.workKey,
        });
      }
      let workKey: string | null = null;
      if (input.plan.kind === "Work" && input.workId) {
        workCount += 1;
        workKey = `PRJ-${workCount}`;
        catalog.set(key("Work", input.workId), {
          label: input.plan.work.title,
          targetId: input.workId,
          targetType: "Work",
        });
        writes.push("create Work");
      }
      receipts.set(input.clientIdempotencyKey, { fingerprint, workKey });
      const targetId =
        input.plan.kind === "Work"
          ? (input.workId ?? "")
          : input.plan.feature.id;
      gaps.set(gap.id, {
        ...gap,
        links: [
          ...gap.links,
          {
            createdAt: new Date().toISOString(),
            id: input.id,
            kind: "Follow-up",
            targetId,
            targetType: input.plan.kind === "Work" ? "Work" : "Feature",
          },
        ],
      });
      return Promise.resolve({
        linkId: input.id,
        workId: input.workId ?? null,
        workKey,
      });
    },
    readFollowUpSource: (account, input) => {
      const gap = gaps.get(input.gapId);
      return Promise.resolve(
        gap && owned(account) ? followUpSource(gap, input) : null,
      );
    },
    run: (account, _mode, work) => {
      if (!owned(account)) {
        return Promise.resolve(null);
      }
      return work({
        findGap: (gapId) => Promise.resolve(gaps.get(gapId) ?? null),
        insertGap: (record) => {
          gaps.set(record.id, record);
          return Promise.resolve();
        },
        listGaps: () =>
          Promise.resolve(
            [...gaps.values()].sort((left, right) =>
              right.createdAt.localeCompare(left.createdAt),
            ),
          ),
        resolver,
        setStatus: (gapId, expected, to, changedAt) => {
          const gap = gaps.get(gapId);
          if (!gap || gap.status !== expected) {
            return Promise.resolve(false);
          }
          gaps.set(gapId, {
            ...gap,
            status: to,
            statusChangedAt: changedAt,
            updatedAt: changedAt,
          });
          return Promise.resolve(true);
        },
      });
    },
  };

  return {
    catalog,
    gaps,
    productGaps: createProductGaps(store),
    writes,
  };
}
