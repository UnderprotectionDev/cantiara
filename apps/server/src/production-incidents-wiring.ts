import type { Database } from "@cantiara/db";
import { mutationFailureKind } from "./features/mutation-and-undo/server/mutation-contract";
import { createDatabaseMutationContract } from "./features/mutation-and-undo/server/mutation-contract-database";
import { createDatabaseProductionIncidents } from "./features/production-incidents/server/production-incidents-database";

/**
 * Service wiring for Production Incidents: plugs the shared atomic Mutation
 * Contract (ADR-0004) into the feature's ports, so the feature never imports
 * the mutation adapter itself. The wiring takes no operator-alarm or error-event
 * input.
 */
export function createProductionIncidents(database: Database) {
  return createDatabaseProductionIncidents(database, {
    mutationContract: (target) =>
      createDatabaseMutationContract(database, { target }),
    mutationFailure: mutationFailureKind,
  });
}
