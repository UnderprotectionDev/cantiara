import type { TrashEarlyDeleteAccess } from "@cantiara/api/trash-early-delete";
import type { Database } from "@cantiara/db";

import { createDatabaseTrashStore } from "./trash-database";
import { createTrashEarlyDelete } from "./trash-early-delete";
import {
  type createDatabaseTrashEventLog,
  createDatabaseTrashExpiry,
} from "./trash-expiry-database";

/** The database adapters behind early `Permanently Delete`; the rules live in `trash-early-delete.ts`. */
export function createDatabaseTrashEarlyDelete(
  database: Database,
  options: {
    events: ReturnType<typeof createDatabaseTrashEventLog>;
    expiry?: ReturnType<typeof createDatabaseTrashExpiry>;
    projectName: (
      accountId: string,
      projectId: string,
    ) => Promise<string | null>;
  },
): TrashEarlyDeleteAccess {
  return createTrashEarlyDelete({
    events: options.events,
    expiry: options.expiry ?? createDatabaseTrashExpiry(database),
    projectName: options.projectName,
    store: createDatabaseTrashStore(database),
  });
}
