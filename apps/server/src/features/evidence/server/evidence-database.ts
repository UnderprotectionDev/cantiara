import type { VersionPinnedEvidence } from "@cantiara/api/evidence";
import { evidenceBinding, recordOrigin } from "@cantiara/db/schema/evidence";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

/** Caller validates and locks both owned ends in this same transaction. */
export async function writeEvidenceBinding(
  executor: MutationDatabaseExecutor,
  input: {
    id: string;
    workspaceId: string;
    pin: VersionPinnedEvidence;
    target: { recordId: string; projectId: string; type: string };
    origin: boolean;
    actorId: string;
    committedAt: Date;
  },
) {
  await executor.insert(evidenceBinding).values({
    id: input.id,
    workspaceId: input.workspaceId,
    sourceProjectId: input.pin.source.projectId,
    sourceRecordId: input.pin.source.recordId,
    targetProjectId: input.target.projectId,
    targetRecordId: input.target.recordId,
    targetRecordType: input.target.type,
    pin: input.pin,
    actorId: input.actorId,
    createdAt: input.committedAt,
    role: "Unspecified",
  });
  if (input.origin) {
    await executor.insert(recordOrigin).values({
      id: crypto.randomUUID(),
      evidenceBindingId: input.id,
      sourceRecordId: input.pin.source.recordId,
      targetRecordId: input.target.recordId,
      location: input.pin.source,
    });
  }
}
