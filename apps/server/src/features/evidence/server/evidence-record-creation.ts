import type { DocumentEvidencePlan } from "@cantiara/api/document-evidence";
import { assumption } from "@cantiara/db/schema/assumption";
import { decision } from "@cantiara/db/schema/decision";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import { work, workKeyAllocation } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

/**
 * Creates the single record of `Convert to new record and bind`.
 * The caller holds the owning Project row lock and passes that locked row.
 */
export async function createEvidenceRecord(
  executor: MutationDatabaseExecutor,
  plan: DocumentEvidencePlan,
  owner: typeof project.$inferSelect,
  input: {
    committedAt: Date;
    idempotencyKey: string;
    payloadFingerprint: string;
    recordId: string;
  },
) {
  const { newRecord } = plan;
  if (!newRecord) {
    throw new Error("A new record is required.");
  }
  const base = {
    id: input.recordId,
    projectId: owner.id,
    title: newRecord.title,
    createdAt: input.committedAt,
    updatedAt: input.committedAt,
    revision: 1,
  };
  const { excerpt } = plan.pin;
  switch (newRecord.type) {
    case "Assumption":
      await executor
        .insert(assumption)
        .values({ ...base, statement: excerpt, life: "Open" });
      return;
    case "Open Question":
      await executor
        .insert(openQuestion)
        .values({ ...base, question: excerpt, life: "Open" });
      return;
    case "Decision":
      await executor
        .insert(decision)
        .values({ ...base, decision: excerpt, life: "Valid" });
      return;
    case "Risk":
      await executor
        .insert(risk)
        .values({ ...base, description: excerpt, life: "Open" });
      return;
    case "Work": {
      if (!newRecord.workType) {
        throw new Error("Choose a Work type.");
      }
      // Same locked Project/key allocation boundary as Document → Work creation.
      const number = owner.workCount + 1;
      const key = `${owner.shortCode}-${number}`;
      await executor
        .update(project)
        .set({
          workCount: number,
          revision: owner.revision + 1,
          updatedAt: input.committedAt,
        })
        .where(eq(project.id, owner.id));
      await executor.insert(workKeyAllocation).values({
        id: crypto.randomUUID(),
        projectId: owner.id,
        clientIdempotencyKey: input.idempotencyKey,
        key,
        number,
        payloadFingerprint: input.payloadFingerprint,
        shortCode: owner.shortCode,
        workId: input.recordId,
        reservedAt: input.committedAt,
      });
      await executor.insert(work).values({
        ...base,
        key,
        number,
        description: excerpt,
        type: newRecord.workType,
        status: "Not Started",
        originOwnerRecordId: plan.pin.source.recordId,
        originComponentId: plan.pin.source.componentId,
        originSourceVersion: String(plan.pin.source.revision),
        originLocation: null,
      });
      return;
    }
    default:
      return;
  }
}
