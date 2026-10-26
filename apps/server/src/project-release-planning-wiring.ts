import { mutationFailureKind } from "@cantiara/api/mutation-contract";
import { createDatabaseMutationContract } from "@cantiara/api/mutation-contract-database";
import type { Database } from "@cantiara/db";
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
