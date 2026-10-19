import {
  EMPTY_PERSONAL_VIEW,
  type PersonalMoodboardView,
  type PersonalMoodboardViewsAccess,
  personalMoodboardViewSchema,
  pruneCollapsed,
} from "@cantiara/api/moodboard-viewport";
import type { Database } from "@cantiara/db";
import {
  moodboardPaletteGroup,
  moodboardPersonalView,
} from "@cantiara/db/schema/moodboard";
import { and, eq } from "drizzle-orm";

import { findOwnedMoodboardRecord } from "./moodboards-database";

function toView(
  row: typeof moodboardPersonalView.$inferSelect | undefined,
): PersonalMoodboardView {
  if (!row) {
    return EMPTY_PERSONAL_VIEW;
  }
  const parsed = personalMoodboardViewSchema.safeParse({
    collapsed: row.collapsed,
    viewport:
      row.centerX !== null && row.centerY !== null && row.zoom !== null
        ? { centerX: row.centerX, centerY: row.centerY, zoom: row.zoom }
        : null,
  });
  return parsed.success ? parsed.data : EMPTY_PERSONAL_VIEW;
}

/**
 * Account-scoped personal viewport. Every read and write is keyed by the
 * caller's Account and requires an owned Moodboard; it never touches the
 * Moodboard record, its revision, mutation receipts, or Snapshot/export input.
 */
export function createDatabaseMoodboardPersonalViews(
  database: Database,
): PersonalMoodboardViewsAccess {
  return {
    async get(accountId, moodboardId) {
      if (
        !(await findOwnedMoodboardRecord(
          database,
          accountId,
          moodboardId,
          false,
        ))
      ) {
        return null;
      }
      const [row] = await database
        .select()
        .from(moodboardPersonalView)
        .where(
          and(
            eq(moodboardPersonalView.accountId, accountId),
            eq(moodboardPersonalView.moodboardId, moodboardId),
          ),
        )
        .limit(1);
      return toView(row);
    },
    async save(accountId, moodboardId, view) {
      if (
        !(await findOwnedMoodboardRecord(
          database,
          accountId,
          moodboardId,
          false,
        ))
      ) {
        return null;
      }
      const groups = await database
        .select({ id: moodboardPaletteGroup.id })
        .from(moodboardPaletteGroup)
        .where(eq(moodboardPaletteGroup.moodboardId, moodboardId));
      const collapsed = pruneCollapsed(
        view.collapsed,
        groups.map(({ id }) => id),
      );
      const values = {
        centerX: view.viewport?.centerX ?? null,
        centerY: view.viewport?.centerY ?? null,
        collapsed,
        zoom: view.viewport?.zoom ?? null,
      };
      const [saved] = await database
        .insert(moodboardPersonalView)
        .values({ accountId, moodboardId, ...values })
        .onConflictDoUpdate({
          set: { ...values, updatedAt: new Date() },
          target: [
            moodboardPersonalView.accountId,
            moodboardPersonalView.moodboardId,
          ],
        })
        .returning();
      return toView(saved);
    },
  };
}
