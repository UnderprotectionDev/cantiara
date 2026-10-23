import type { Database } from "@cantiara/db";
import { mutationFailureKind } from "./features/mutation-and-undo/server/mutation-contract";
import { createDatabaseMutationContract } from "./features/mutation-and-undo/server/mutation-contract-database";
import { createDatabaseProjectReleasePlanning } from "./features/project-release-planning/server/project-release-planning-database";

/**
 * Service wiring for Project Release Planning: plugs the shared atomic
 * Mutation Contract (ADR-0004) into the feature's ports, so the feature never
 * imports the mutation adapter itself.
 */
export function createProjectReleasePlanning(database: Database) {
  return createDatabaseProjectReleasePlanning(database, {
    mutationContract: (target) =>
      createDatabaseMutationContract(database, { target }),
    mutationFailure: mutationFailureKind,
  });
}
