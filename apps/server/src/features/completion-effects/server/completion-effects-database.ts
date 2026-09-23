import {
  type CompletionEffectsPreferences,
  type CompletionEffectsPreferencesAccess,
  type CompletionEffectsPreferencesSnapshot,
  completionEffectsPreferencesSchema,
  DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
} from "@cantiara/api/completion-effects";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { completionEffectPreferences } from "@cantiara/db/schema/completion-effects";
import { and, eq } from "drizzle-orm";

import type { MutationDatabaseTargetAdapter } from "../../mutation-and-undo/server/mutation-contract-database";

type CompletionEffectPreferencesRecord =
  typeof completionEffectPreferences.$inferSelect;

function preferenceValue(
  record: Pick<
    CompletionEffectPreferencesRecord,
    "enabled" | "palette" | "theme"
  >,
): CompletionEffectsPreferences {
  return completionEffectsPreferencesSchema.parse({
    enabled: record.enabled,
    palette: record.palette,
    theme: record.theme,
  });
}

function toTarget(record: CompletionEffectPreferencesRecord) {
  return {
    id: record.accountId,
    revision: record.revision,
    value: preferenceValue(record),
  } satisfies MutationTarget<CompletionEffectsPreferences>;
}

function defaultTarget(
  targetId: string,
): MutationTarget<CompletionEffectsPreferences> {
  return {
    id: targetId,
    revision: 0,
    value: DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
  };
}

export const completionEffectsPreferencesMutationTarget: MutationDatabaseTargetAdapter<CompletionEffectsPreferences> =
  {
    async find(executor, targetId, lock) {
      const query = executor
        .select()
        .from(completionEffectPreferences)
        .where(eq(completionEffectPreferences.accountId, targetId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record ? toTarget(record) : defaultTarget(targetId);
    },

    async update(executor, input) {
      const revision = input.expectedRevision + 1;
      const [updated] = await executor
        .update(completionEffectPreferences)
        .set({
          enabled: input.nextValue.enabled,
          palette: input.nextValue.palette,
          revision,
          theme: input.nextValue.theme,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(completionEffectPreferences.accountId, input.targetId),
            eq(completionEffectPreferences.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        return toTarget(updated);
      }

      const [inserted] = await executor
        .insert(completionEffectPreferences)
        .values({
          accountId: input.targetId,
          enabled: input.nextValue.enabled,
          palette: input.nextValue.palette,
          revision,
          theme: input.nextValue.theme,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      return inserted ? toTarget(inserted) : null;
    },
  };

export function createDatabaseCompletionEffectsPreferences(
  database: Database,
): CompletionEffectsPreferencesAccess {
  return {
    async get(accountId): Promise<CompletionEffectsPreferencesSnapshot> {
      const [record] = await database
        .select()
        .from(completionEffectPreferences)
        .where(eq(completionEffectPreferences.accountId, accountId))
        .limit(1);

      if (!record) {
        return {
          ...DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
          isSaved: false,
          revision: 0,
          savedAt: null,
        };
      }

      return {
        ...preferenceValue(record),
        isSaved: true,
        revision: record.revision,
        savedAt: record.updatedAt.toISOString(),
      };
    },
  };
}
