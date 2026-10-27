import type { PersonalRemindersAccess } from "@cantiara/api/personal-reminders";
import type { Database } from "@cantiara/db";
import { createDatabasePersonalReminders } from "./features/personal-reminders/server/personal-reminders-database";
import { createDatabaseProjectUpdates } from "./features/project-updates/server/project-updates-database";

/**
 * Service wiring for Manual Project Updates: hands the feature the Personal
 * Reminders access that plans and fires its optional reminder, so the feature
 * never imports the Personal Reminders server itself. The same access also
 * serves the due-reminder worker, so callers pass the shared one.
 */
export function createProjectUpdatesService(
  database: Database,
  personalReminders: PersonalRemindersAccess = createDatabasePersonalReminders(
    database,
  ),
) {
  return createDatabaseProjectUpdates(database, personalReminders);
}
