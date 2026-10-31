import type {
  PersonalDataReader,
  PersonalDataSnapshot,
} from "@cantiara/api/personal-data-rights";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceContact,
  workspaceContactEmail,
  workspaceContactFeedback,
} from "@cantiara/db/schema/contact";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { feedback } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { researchSession } from "@cantiara/db/schema/research-session";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

function researchTitle(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "title" in data) {
    const { title } = data as { title: unknown };
    if (typeof title === "string" && title.trim()) {
      return title;
    }
  }
  return fallback;
}

/**
 * Reads the five listed sources of one Contact of the account's own
 * Workspace: the Contact record, its email aliases, the Feedback linked to it,
 * the Research Sessions it took part in and the evidence bindings that touch
 * that Feedback or those sessions. Nothing else is selected, so no other
 * Contact, session, token or log can reach the package.
 */
export function createDatabasePersonalDataReader(
  database: Database,
): PersonalDataReader {
  return {
    async read(accountId, contactId) {
      const [owned] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      if (!owned) {
        return null;
      }
      const workspaceId = owned.id;
      const [contact] = await database
        .select()
        .from(workspaceContact)
        .where(
          and(
            eq(workspaceContact.id, contactId),
            eq(workspaceContact.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!contact) {
        return null;
      }
      const [emails, feedbackRows, sessions] = await Promise.all([
        database
          .select({ email: workspaceContactEmail.normalizedEmail })
          .from(workspaceContactEmail)
          .where(
            and(
              eq(workspaceContactEmail.contactId, contact.id),
              eq(workspaceContactEmail.workspaceId, workspaceId),
            ),
          )
          .orderBy(asc(workspaceContactEmail.normalizedEmail)),
        database
          .select({
            channel: feedback.channel,
            id: feedback.id,
            occurredAt: feedback.occurredAt,
            originalMessage: feedback.originalMessage,
            status: feedback.status,
            title: feedback.title,
            url: feedback.url,
          })
          .from(workspaceContactFeedback)
          .innerJoin(
            feedback,
            eq(workspaceContactFeedback.feedbackId, feedback.id),
          )
          .where(
            and(
              eq(workspaceContactFeedback.contactId, contact.id),
              eq(workspaceContactFeedback.workspaceId, workspaceId),
            ),
          )
          .orderBy(asc(feedback.occurredAt), asc(feedback.id)),
        database
          .select({ data: researchSession.data, id: researchSession.id })
          .from(researchSession)
          .innerJoin(project, eq(researchSession.projectId, project.id))
          .where(
            and(
              eq(project.workspaceId, workspaceId),
              sql`${researchSession.data}->>'participantContactId' = ${contact.id}`,
            ),
          )
          .orderBy(asc(researchSession.id)),
      ]);
      const recordIds = [
        ...feedbackRows.map((row) => row.id),
        ...sessions.map((row) => row.id),
      ];
      const evidenceRows = recordIds.length
        ? await database
            .select({
              createdAt: evidenceBinding.createdAt,
              id: evidenceBinding.id,
              role: evidenceBinding.role,
              sourceRecordId: evidenceBinding.sourceRecordId,
              targetRecordId: evidenceBinding.targetRecordId,
              targetRecordType: evidenceBinding.targetRecordType,
            })
            .from(evidenceBinding)
            .where(
              and(
                eq(evidenceBinding.workspaceId, workspaceId),
                or(
                  inArray(evidenceBinding.sourceRecordId, recordIds),
                  inArray(evidenceBinding.targetRecordId, recordIds),
                ),
              ),
            )
            .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id))
        : [];
      const snapshot: PersonalDataSnapshot = {
        contact: {
          archivedAt: contact.archivedAt?.toISOString() ?? null,
          createdAt: contact.createdAt.toISOString(),
          displayName: contact.displayName,
          emails: emails.map((row) => row.email),
          id: contact.id,
          updatedAt: contact.updatedAt.toISOString(),
        },
        evidence: evidenceRows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
        feedback: feedbackRows.map((row) => ({
          ...row,
          occurredAt: row.occurredAt.toISOString(),
        })),
        research: sessions.map((row) => ({
          data: row.data,
          id: row.id,
          title: researchTitle(row.data, row.id),
        })),
      };
      return snapshot;
    },
  };
}
