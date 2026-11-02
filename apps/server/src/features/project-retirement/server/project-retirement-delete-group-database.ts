import { DELETED_TARGET_MARK } from "@cantiara/api/project-retirement";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { externalSurface } from "@cantiara/db/schema/external-surface";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import { work } from "@cantiara/db/schema/work";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";

import type { RetirementDeleteGroupPort } from "./project-retirement";

const GROUP_TABLES = [
  ["Work", work],
  ["Document", document],
  ["Decision", decision],
  ["Risk", risk],
  ["Screen", screen],
] as const;

/**
 * The Proje silme grubu from the database: only rows whose canonical owner is
 * this Project (`project_id`) and that are not yet in Trash. Workspace,
 * Account and Personal Wiki rows carry no project id and never appear.
 * External Surfaces are read after they were revoked, because a surface
 * enters Trash only once terminal.
 */
export function createDatabaseDeleteGroup(
  database: Database,
  deps: {
    revokeSurface: (accountId: string, surfaceId: string) => Promise<unknown>;
  },
): RetirementDeleteGroupPort {
  return {
    async members(_accountId, projectId) {
      const owned = await Promise.all(
        GROUP_TABLES.map(async ([recordKind, table]) => {
          const rows = await database
            .select({
              id: table.id,
              revision: table.revision,
              title: table.title,
            })
            .from(table)
            .where(
              and(eq(table.projectId, projectId), isNull(table.trashedAt)),
            );
          return rows.map((row) => ({
            baseRevision: row.revision,
            label: row.title,
            recordId: row.id,
            recordKind,
          }));
        }),
      );
      const surfaces = await database
        .select({
          id: externalSurface.id,
          kind: externalSurface.surfaceKind,
          revision: externalSurface.revision,
        })
        .from(externalSurface)
        .where(
          and(
            eq(externalSurface.projectId, projectId),
            isNull(externalSurface.trashedAt),
            isNotNull(externalSurface.cancelledAt),
          ),
        );
      return [
        ...owned.flat(),
        ...surfaces.map((row) => ({
          baseRevision: row.revision,
          label: row.kind ?? "External Surface",
          recordId: row.id,
          recordKind: "External Surface",
        })),
      ];
    },

    async relations(_accountId, projectId) {
      const rows = await database
        .select({
          sourceProjectId: work.projectId,
          sourceTitle: work.title,
          targetLabel: workRelation.targetLabel,
        })
        .from(workRelation)
        .innerJoin(work, eq(work.id, workRelation.sourceWorkId))
        .where(
          and(
            eq(workRelation.targetProjectId, projectId),
            isNull(workRelation.deletedAt),
            ne(work.projectId, projectId),
          ),
        );
      return rows.map((row) => ({
        mark: DELETED_TARGET_MARK,
        scope: `Project ${row.sourceProjectId}`,
        sourceLabel: row.sourceTitle,
        targetLabel: row.targetLabel,
      }));
    },

    revokeSurface: deps.revokeSurface,
  };
}
