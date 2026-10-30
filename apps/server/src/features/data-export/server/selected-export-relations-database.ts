import type {
  ExportRelationPreview,
  ExportSubject,
} from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import {
  workspaceCompanyFeedback,
  workspaceContactCompanyAffiliation,
  workspaceContactFeedback,
  workspaceContactPersona,
} from "@cantiara/db/schema/contact";
import { decisionSupersession } from "@cantiara/db/schema/decision";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import {
  feedbackAttachment,
  feedbackWorkOrigin,
} from "@cantiara/db/schema/feedback";
import { productGapLink } from "@cantiara/db/schema/product-gap";
import { projectGoalRelation } from "@cantiara/db/schema/project-goal-relation";
import { riskContextRelation } from "@cantiara/db/schema/risk";
import { and, inArray, isNull, or } from "drizzle-orm";

/**
 * Every relation a selected record is an end of, whatever the other end is.
 * The seam keeps only those whose both ends are selected and counts the rest
 * as omitted, so a reader reports the full set here and never decides the
 * closed world itself. Only ids and kinds leave: target labels, pins,
 * interpretation text and actors stay in the Workspace.
 */
type RelationReader = (
  database: Database,
  ids: string[],
) => Promise<ExportRelationPreview[]>;

const relation = (
  fromRecordId: string,
  kind: string,
  toRecordId: string,
): ExportRelationPreview => ({ fromRecordId, kind, toRecordId });

/** The `target_record_type` an Evidence binding names for a record type. */
function evidenceTargetType(recordType: ExportSubject): string {
  return ["Work", "Feature", "Bug", "Task", "Research", "Improvement"].includes(
    recordType,
  )
    ? "Work"
    : recordType;
}

/** Evidence and Origin bindings carry across every Project-owned family. */
function evidenceRelations(recordType: ExportSubject): RelationReader {
  return async (database, ids) => {
    const rows = await database
      .select({
        source: evidenceBinding.sourceRecordId,
        target: evidenceBinding.targetRecordId,
      })
      .from(evidenceBinding)
      .where(
        or(
          inArray(evidenceBinding.sourceRecordId, ids),
          and(
            inArray(evidenceBinding.targetRecordId, ids),
            inArray(evidenceBinding.targetRecordType, [
              evidenceTargetType(recordType),
            ]),
          ),
        ),
      );
    return rows.map((row) => relation(row.source, "Evidence", row.target));
  };
}

function goalMembers(memberType: string): RelationReader {
  return async (database, ids) => {
    const rows = await database
      .select()
      .from(projectGoalRelation)
      .where(
        and(
          inArray(projectGoalRelation.memberId, ids),
          inArray(projectGoalRelation.memberType, [memberType]),
          isNull(projectGoalRelation.removedAt),
        ),
      );
    return rows.map((row) => relation(row.goalId, row.kind, row.memberId));
  };
}

const goalOwn: RelationReader = async (database, ids) => {
  const rows = await database
    .select()
    .from(projectGoalRelation)
    .where(
      and(
        inArray(projectGoalRelation.goalId, ids),
        isNull(projectGoalRelation.removedAt),
      ),
    );
  return rows.map((row) => relation(row.goalId, row.kind, row.memberId));
};

function gapLinksTo(targetType: string): RelationReader {
  return async (database, ids) => {
    const rows = await database
      .select()
      .from(productGapLink)
      .where(
        and(
          inArray(productGapLink.targetId, ids),
          inArray(productGapLink.targetType, [targetType]),
        ),
      );
    return rows.map((row) => relation(row.gapId, row.kind, row.targetId));
  };
}

const currentAffiliations =
  (column: "companyId" | "contactId"): RelationReader =>
  async (database, ids) => {
    const rows = await database
      .select()
      .from(workspaceContactCompanyAffiliation)
      .where(
        and(
          inArray(workspaceContactCompanyAffiliation[column], ids),
          isNull(workspaceContactCompanyAffiliation.endedAt),
        ),
      );
    return rows.map((row) =>
      relation(row.contactId, "Belongs to Company", row.companyId),
    );
  };

const RELATIONS: Partial<Record<ExportSubject, RelationReader[]>> = {
  Company: [
    currentAffiliations("companyId"),
    async (database, ids) => {
      const rows = await database
        .select()
        .from(workspaceCompanyFeedback)
        .where(inArray(workspaceCompanyFeedback.companyId, ids));
      return rows.map((row) =>
        relation(row.feedbackId, "Belongs to Company", row.companyId),
      );
    },
  ],
  Contact: [
    currentAffiliations("contactId"),
    async (database, ids) => {
      const [feedback, personas] = await Promise.all([
        database
          .select()
          .from(workspaceContactFeedback)
          .where(inArray(workspaceContactFeedback.contactId, ids)),
        database
          .select()
          .from(workspaceContactPersona)
          .where(inArray(workspaceContactPersona.contactId, ids)),
      ]);
      return [
        ...feedback.map((row) =>
          relation(row.contactId, "Feedback", row.feedbackId),
        ),
        ...personas.map((row) =>
          relation(row.contactId, "Persona", row.documentId),
        ),
      ];
    },
  ],
  Decision: [
    async (database, ids) => {
      const rows = await database
        .select()
        .from(decisionSupersession)
        .where(
          or(
            inArray(decisionSupersession.predecessorId, ids),
            inArray(decisionSupersession.successorId, ids),
          ),
        );
      return rows.map((row) =>
        relation(row.successorId, "Supersedes", row.predecessorId),
      );
    },
    gapLinksTo("Decision"),
  ],
  Feedback: [
    async (database, ids) => {
      const [attachments, origins, contacts, companies] = await Promise.all([
        database
          .select()
          .from(feedbackAttachment)
          .where(inArray(feedbackAttachment.feedbackId, ids)),
        database
          .select()
          .from(feedbackWorkOrigin)
          .where(inArray(feedbackWorkOrigin.feedbackId, ids)),
        database
          .select()
          .from(workspaceContactFeedback)
          .where(inArray(workspaceContactFeedback.feedbackId, ids)),
        database
          .select()
          .from(workspaceCompanyFeedback)
          .where(inArray(workspaceCompanyFeedback.feedbackId, ids)),
      ]);
      return [
        ...attachments.map((row) =>
          relation(row.feedbackId, "Attachment", row.attachmentId),
        ),
        ...origins.map((row) => relation(row.feedbackId, "Origin", row.workId)),
        ...contacts.map((row) =>
          relation(row.contactId, "Feedback", row.feedbackId),
        ),
        ...companies.map((row) =>
          relation(row.feedbackId, "Belongs to Company", row.companyId),
        ),
      ];
    },
  ],
  Milestone: [goalMembers("Milestone")],
  "Product Gap": [
    async (database, ids) => {
      const rows = await database
        .select()
        .from(productGapLink)
        .where(inArray(productGapLink.gapId, ids));
      return rows.map((row) => relation(row.gapId, row.kind, row.targetId));
    },
  ],
  "Project Goal": [goalOwn],
  "Project Release": [
    goalMembers("Project Release"),
    async (database, ids) => {
      const rows = await database
        .select()
        .from(riskContextRelation)
        .where(inArray(riskContextRelation.projectReleaseId, ids));
      return rows.flatMap((row) =>
        row.projectReleaseId
          ? [relation(row.riskId, "Context", row.projectReleaseId)]
          : [],
      );
    },
  ],
  Risk: [
    async (database, ids) => {
      const rows = await database
        .select()
        .from(riskContextRelation)
        .where(inArray(riskContextRelation.riskId, ids));
      return rows.flatMap((row) => {
        const target = row.projectReleaseId ?? row.focusPeriodId;
        return target ? [relation(row.riskId, "Context", target)] : [];
      });
    },
  ],
};

// "Work" is the mixed-type Work list; it reads what every Work type reads.
for (const work of [
  "Work",
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
]) {
  RELATIONS[work as ExportSubject] = [
    goalMembers("Work"),
    async (database, ids) => {
      const rows = await database
        .select()
        .from(feedbackWorkOrigin)
        .where(inArray(feedbackWorkOrigin.workId, ids));
      return rows.map((row) => relation(row.feedbackId, "Origin", row.workId));
    },
    gapLinksTo("Work"),
  ];
}

/** Types whose records Evidence bindings can name (Contact and Company not). */
const NO_EVIDENCE: ExportSubject[] = ["Contact", "Company", "Source"];

/** One relation once, whichever reader or direction produced it. */
export function dedupeRelations(
  relations: readonly ExportRelationPreview[],
): ExportRelationPreview[] {
  const seen = new Set<string>();
  const unique: ExportRelationPreview[] = [];
  for (const item of relations) {
    const key = JSON.stringify([item.fromRecordId, item.kind, item.toRecordId]);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

/**
 * Relations of the selected records of one record type beyond the Work
 * relation table: Decision supersession, Risk context, Feedback attachments,
 * origins and Contact/Company links, Product Gap links, Goal membership and
 * Evidence bindings. Read-only; returns every relation touching a selected
 * record so the seam can count the one-ended ones as omitted.
 */
export async function readExtraRelations(
  database: Database,
  recordType: ExportSubject,
  ids: readonly string[],
): Promise<ExportRelationPreview[]> {
  if (ids.length === 0) {
    return [];
  }
  const readers = [
    ...(RELATIONS[recordType] ?? []),
    ...(NO_EVIDENCE.includes(recordType)
      ? []
      : [evidenceRelations(recordType)]),
  ];
  const lists = await Promise.all(
    readers.map((reader) => reader(database, [...ids])),
  );
  return dedupeRelations(lists.flat());
}
