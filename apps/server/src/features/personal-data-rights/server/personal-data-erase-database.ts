// biome-ignore-all lint/performance/noAwaitInLoops: rows are rewritten one at a time inside one transaction.
import type {
  PersonalDataAudit,
  PersonalDataEraser,
} from "@cantiara/api/personal-data-rights";
import {
  REDACTED_VALUE_MARK,
  redactText,
} from "@cantiara/api/security-redaction";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceContact,
  workspaceContactEmail,
  workspaceContactFeedback,
} from "@cantiara/db/schema/contact";
import {
  evidenceBinding,
  evidenceBindingHistory,
} from "@cantiara/db/schema/evidence";
import { feedback } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { researchSession } from "@cantiara/db/schema/research-session";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { contentFreePin, contentFreeSession } from "./personal-data-erase";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function redactByValue(text: string, values: readonly string[]): string {
  let next = text;
  for (const value of values) {
    next = redactText(next, value);
  }
  return next;
}

async function tombstoneContact(
  transaction: Transaction,
  workspaceId: string,
  contactId: string,
) {
  const [contact] = await transaction
    .select({ id: workspaceContact.id })
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
  await transaction
    .update(workspaceContact)
    .set({
      displayName: null,
      revision: sql`${workspaceContact.revision} + 1`,
    })
    .where(eq(workspaceContact.id, contactId));
  const aliases = await transaction
    .delete(workspaceContactEmail)
    .where(
      and(
        eq(workspaceContactEmail.contactId, contactId),
        eq(workspaceContactEmail.workspaceId, workspaceId),
      ),
    )
    .returning({ id: workspaceContactEmail.id });
  return aliases.length;
}

/** Title, original message and URL become the mark; the link row stays. */
async function tombstoneFeedback(
  transaction: Transaction,
  workspaceId: string,
  contactId: string,
) {
  const feedbackIds = (
    await transaction
      .select({ id: workspaceContactFeedback.feedbackId })
      .from(workspaceContactFeedback)
      .where(
        and(
          eq(workspaceContactFeedback.contactId, contactId),
          eq(workspaceContactFeedback.workspaceId, workspaceId),
        ),
      )
  ).map((row) => row.id);
  if (feedbackIds.length > 0) {
    await transaction
      .update(feedback)
      .set({
        originalMessage: REDACTED_VALUE_MARK,
        revision: sql`${feedback.revision} + 1`,
        title: REDACTED_VALUE_MARK,
        url: null,
      })
      .where(inArray(feedback.id, feedbackIds));
  }
  return feedbackIds;
}

/** The revision stays: it must equal `data.revision` in storage. */
async function tombstoneResearch(
  transaction: Transaction,
  workspaceId: string,
  contactId: string,
  values: readonly string[],
) {
  const sessions = await transaction
    .select({ data: researchSession.data, id: researchSession.id })
    .from(researchSession)
    .innerJoin(project, eq(researchSession.projectId, project.id))
    .where(
      and(
        eq(project.workspaceId, workspaceId),
        sql`${researchSession.data}->>'participantContactId' = ${contactId}`,
      ),
    );
  for (const session of sessions) {
    const data = contentFreeSession(session.data, values);
    await transaction
      .update(researchSession)
      .set({ data: data as typeof session.data })
      .where(eq(researchSession.id, session.id));
  }
  return sessions.map((row) => row.id);
}

/**
 * The evidence that names the Contact: the Founder interpretation text is
 * redacted by value, the captured pin becomes content-free (bound source
 * identity stays) and the binding history rows that still hold older
 * interpretation text are redacted by value. Roles, ids, times and links stay.
 */
async function tombstoneEvidence(
  transaction: Transaction,
  workspaceId: string,
  recordIds: string[],
  values: readonly string[],
) {
  if (recordIds.length === 0) {
    return 0;
  }
  const bindings = await transaction
    .select({
      id: evidenceBinding.id,
      interpretation: evidenceBinding.interpretation,
      pin: evidenceBinding.pin,
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
    );
  let changed = 0;
  const bindingIds: string[] = [];
  for (const binding of bindings) {
    bindingIds.push(binding.id);
    const interpretation = binding.interpretation
      ? redactByValue(binding.interpretation, values)
      : binding.interpretation;
    const pin = contentFreePin(binding.pin);
    if (interpretation === binding.interpretation && pin === binding.pin) {
      continue;
    }
    const patch: {
      interpretation?: string | null;
      pin?: unknown;
    } = {};
    if (interpretation !== binding.interpretation) {
      patch.interpretation = interpretation;
    }
    if (pin !== binding.pin) {
      patch.pin = pin as typeof binding.pin;
    }
    await transaction
      .update(evidenceBinding)
      .set(patch)
      .where(eq(evidenceBinding.id, binding.id));
    changed += 1;
  }
  // Earlier edits keep their old interpretation text in the binding history;
  // the Security Redaction (78) spread does not reach these rows.
  if (bindingIds.length === 0) {
    return changed;
  }
  const historyRows = await transaction
    .select({
      id: evidenceBindingHistory.id,
      interpretation: evidenceBindingHistory.interpretation,
      previousInterpretation: evidenceBindingHistory.previousInterpretation,
    })
    .from(evidenceBindingHistory)
    .where(inArray(evidenceBindingHistory.evidenceBindingId, bindingIds));
  for (const row of historyRows) {
    const interpretation = row.interpretation
      ? redactByValue(row.interpretation, values)
      : row.interpretation;
    const previousInterpretation = row.previousInterpretation
      ? redactByValue(row.previousInterpretation, values)
      : row.previousInterpretation;
    if (
      interpretation === row.interpretation &&
      previousInterpretation === row.previousInterpretation
    ) {
      continue;
    }
    await transaction
      .update(evidenceBindingHistory)
      .set({ interpretation, previousInterpretation })
      .where(eq(evidenceBindingHistory.id, row.id));
    changed += 1;
  }
  return changed;
}

/**
 * The content-free tombstone of one Contact's own records (spec 81 #517). It
 * runs after Security Redaction (78) removed every other copy and is not a
 * spread: it only reaches this Contact's name, email aliases, Feedback and the
 * Research and evidence that name them, including the bound pins and the
 * evidence-binding history rows. Ids, times, statuses and links stay so
 * history keeps its shape; nothing moves through Trash. Idempotent.
 */
export function createDatabasePersonalDataEraser(
  database: Database,
): PersonalDataEraser {
  return {
    tombstone(accountId, contactId, values) {
      return database.transaction(async (transaction) => {
        const counts = {
          contacts: 0,
          emailAliases: 0,
          evidence: 0,
          feedback: 0,
          research: 0,
        };
        const [owned] = await transaction
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.ownerAccountId, accountId))
          .limit(1);
        if (!owned) {
          return counts;
        }
        const aliases = await tombstoneContact(
          transaction,
          owned.id,
          contactId,
        );
        if (aliases === null) {
          return counts;
        }
        const feedbackIds = await tombstoneFeedback(
          transaction,
          owned.id,
          contactId,
        );
        const researchIds = await tombstoneResearch(
          transaction,
          owned.id,
          contactId,
          values,
        );
        return {
          contacts: 1,
          emailAliases: aliases,
          evidence: await tombstoneEvidence(
            transaction,
            owned.id,
            [...feedbackIds, ...researchIds],
            values,
          ),
          feedback: feedbackIds.length,
          research: researchIds.length,
        };
      });
    },
  };
}

/**
 * Denetim kaydı of export and erase in the security event log: the event type,
 * the time, the aliased actor and the Contact id. No name, email, message or
 * any other personal value ever enters the log.
 */
export function createDatabasePersonalDataAudit({
  actorAlias,
  database,
  newId = () => crypto.randomUUID(),
}: {
  actorAlias: (accountId: string) => Promise<string>;
  database: SecurityEventDatabase;
  newId?: () => string;
}): PersonalDataAudit {
  return {
    async record(entry) {
      await database.insert(securityEvent).values({
        actorAlias: await actorAlias(entry.accountId),
        id: `${entry.type}:${newId()}`,
        occurredAt: new Date(entry.at),
        targetSessionAlias: `Contact:${entry.contactId}`,
        type: entry.type,
        version: 1,
      });
    },
  };
}
