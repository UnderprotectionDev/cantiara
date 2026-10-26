import { mutationFailureKind } from "@cantiara/api/mutation-contract";
import { createDatabaseMutationContract } from "@cantiara/api/mutation-contract-database";
import type { Database } from "@cantiara/db";
import { insertWorkWithKeyAllocation } from "./features/evidence/server/evidence-record-creation";
import { createDatabaseProductionIncidents } from "./features/production-incidents/server/production-incidents-database";

/**
 * Service wiring for Production Incidents: plugs the shared atomic Mutation
 * Contract (ADR-0004) and the shared Work insertion into the feature's ports, so the feature never imports
 * the mutation adapter itself. The wiring takes no operator-alarm or error-event
 * input.
 */
export function createProductionIncidents(database: Database) {
  return createDatabaseProductionIncidents(database, {
    // The one Work insertion boundary also used by conversions and `Create work and link`.
    insertWork: (executor, owner, input) =>
      insertWorkWithKeyAllocation(
        executor as Parameters<typeof insertWorkWithKeyAllocation>[0],
        owner,
        input,
      ),
    mutationContract: (target) =>
      createDatabaseMutationContract(database, { target }),
    mutationFailure: mutationFailureKind,
  });
}
