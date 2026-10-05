import type { ProjectShellAccess } from "@cantiara/api/project-shell";
import type { ProjectSourceRecordsAccess } from "@cantiara/api/project-source-records";
import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { createDatabaseCustomFieldFinalizationWriter } from "../../custom-fields/server/custom-fields-mutation-database";
import { createDatabaseProjectSourceRecords } from "../../project-source-records/server/project-source-records-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createRecordTableAccess } from "./record-table";

type WorkLifecycleDatabaseOptions = NonNullable<
  Parameters<typeof createDatabaseWorkLifecycle>[1]
>;

export function createDatabaseRecordTable({
  customFieldValueWriter,
  database,
  projectShell,
  projectSourceRecords,
  workLifecycle,
}: {
  customFieldValueWriter: WorkLifecycleDatabaseOptions["customFieldValueWriter"];
  database: Database;
  projectShell: ProjectShellAccess;
  projectSourceRecords: ProjectSourceRecordsAccess;
  workLifecycle: WorkLifecycleAccess;
}) {
  return createRecordTableAccess({
    projectShell,
    projectSourceRecords,
    workLifecycle,
    withWriteTransaction: (run) =>
      database.transaction((transaction) => {
        const transactionDatabase = transaction as unknown as Database;
        return run({
          projectSourceRecords:
            createDatabaseProjectSourceRecords(transactionDatabase),
          workLifecycle: createDatabaseWorkLifecycle(transactionDatabase, {
            customFieldValueWriter:
              customFieldValueWriter ??
              createDatabaseCustomFieldFinalizationWriter(),
          }),
        });
      }),
  });
}
