import { confirmMigrationArtifactInputSchema } from "@cantiara/api/schema-migration-artifact";
import { z } from "zod";

// Both forms collect parts of the `confirmMigrationArtifact` input, so their
// field rules come from that contract instead of being restated here.
const confirmFields = confirmMigrationArtifactInputSchema.shape;

export const upEditFormSchema = z.object({
  upSql: confirmFields.editedUpSql.unwrap().unwrap(),
});

export const confirmArtifactFormSchema = z.object({
  confirmedDestructiveOperationIds:
    confirmFields.confirmedDestructiveOperationIds,
  supersedes: confirmFields.supersedes,
});
