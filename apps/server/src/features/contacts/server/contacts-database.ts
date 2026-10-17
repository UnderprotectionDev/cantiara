import {
  type Company,
  type Contact,
  type ContactStore,
  companySchema,
  contactResolutionSchema,
  contactSchema,
  type MergeUndoPreview,
  mergeResultSchema,
  mergeUndoPreviewSchema,
  type ParsedMergeContactsInput,
  type ParsedUndoMergeInput,
  undoMergeResultSchema,
} from "@cantiara/api/contacts";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceCompany,
  workspaceContact,
  workspaceContactAuditEvent,
  workspaceContactCompanyAffiliation,
  workspaceContactEmail,
  workspaceContactFeedback,
  workspaceContactMerge,
  workspaceContactMergeLink,
  workspaceContactPersona,
  workspaceContactRetiredIdentity,
} from "@cantiara/db/schema/contact";
import { document } from "@cantiara/db/schema/document";
import { feedback } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { accountActorAlias } from "../../account-access/server/github-identity-confirmation";

import {
  CompanyNotFoundError,
  ContactFeedbackNotFoundError,
  ContactMergeNotFoundError,
  ContactMergeUndoBlockedError,
  ContactMergeUndoConflictError,
  ContactNotFoundError,
  ContactPersonaDocumentNotFoundError,
  ContactRevisionConflictError,
  createContacts,
} from "./contacts";

type ContactExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;

function toCompany(
  record: typeof workspaceCompany.$inferSelect,
  contactCount: number,
): Company {
  return companySchema.parse({
    archivedAt: record.archivedAt?.toISOString() ?? null,
    contactCount,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    revision: record.revision,
  });
}

async function findWorkspaceId(
  database: Pick<Database, "select">,
  accountId: string,
) {
  const [record] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function requireCompany(
  executor: Pick<Database, "select">,
  workspaceId: string,
  companyId: string,
) {
  const [record] = await executor
    .select()
    .from(workspaceCompany)
    .where(
      and(
        eq(workspaceCompany.id, companyId),
        eq(workspaceCompany.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!record) {
    throw new CompanyNotFoundError(companyId);
  }
  return record;
}

async function findLockedContact(
  executor: Pick<Database, "select">,
  workspaceId: string,
  contactId: string,
) {
  const [record] = await executor
    .select()
    .from(workspaceContact)
    .where(
      and(
        eq(workspaceContact.id, contactId),
        eq(workspaceContact.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .for("update");
  return record;
}

async function lockContact(
  executor: Pick<Database, "select">,
  workspaceId: string,
  contactId: string,
) {
  const record = await findLockedContact(executor, workspaceId, contactId);
  if (!record) {
    throw new ContactNotFoundError(contactId);
  }
  return record;
}

async function readContacts(
  executor: Pick<Database, "select">,
  workspaceId: string,
  contactIds?: readonly string[],
): Promise<Contact[]> {
  const scope = contactIds
    ? and(
        eq(workspaceContact.workspaceId, workspaceId),
        inArray(workspaceContact.id, [...contactIds]),
      )
    : eq(workspaceContact.workspaceId, workspaceId);
  const contacts = await executor
    .select()
    .from(workspaceContact)
    .where(scope)
    .orderBy(desc(workspaceContact.createdAt), asc(workspaceContact.id));
  if (contacts.length === 0) {
    return [];
  }
  const ids = contacts.map((contact) => contact.id);

  const [emails, affiliations, personas] = await Promise.all([
    executor
      .select()
      .from(workspaceContactEmail)
      .where(inArray(workspaceContactEmail.contactId, ids))
      .orderBy(
        asc(workspaceContactEmail.createdAt),
        asc(workspaceContactEmail.normalizedEmail),
      ),
    executor
      .select({
        affiliation: workspaceContactCompanyAffiliation,
        company: workspaceCompany,
      })
      .from(workspaceContactCompanyAffiliation)
      .innerJoin(
        workspaceCompany,
        eq(workspaceCompany.id, workspaceContactCompanyAffiliation.companyId),
      )
      .where(inArray(workspaceContactCompanyAffiliation.contactId, ids))
      .orderBy(asc(workspaceContactCompanyAffiliation.startedAt)),
    executor
      .select({
        document: {
          archivedAt: document.archivedAt,
          id: document.id,
          projectId: document.projectId,
          title: document.title,
        },
        link: workspaceContactPersona,
      })
      .from(workspaceContactPersona)
      .innerJoin(document, eq(document.id, workspaceContactPersona.documentId))
      .where(inArray(workspaceContactPersona.contactId, ids))
      .orderBy(asc(workspaceContactPersona.createdAt)),
  ]);

  return contacts.map((contact) => {
    const history = affiliations
      .filter(({ affiliation }) => affiliation.contactId === contact.id)
      .map(({ affiliation, company }) => ({
        company: {
          archivedAt: company.archivedAt?.toISOString() ?? null,
          id: company.id,
          name: company.name,
        },
        endedAt: affiliation.endedAt?.toISOString() ?? null,
        startedAt: affiliation.startedAt.toISOString(),
      }));
    const current = history.find((entry) => entry.endedAt === null);

    return contactSchema.parse({
      archivedAt: contact.archivedAt?.toISOString() ?? null,
      company: current?.company ?? null,
      companyHistory: history,
      createdAt: contact.createdAt.toISOString(),
      displayName: contact.displayName,
      emails: emails
        .filter((email) => email.contactId === contact.id)
        .map((email) => email.normalizedEmail),
      id: contact.id,
      personaDocuments: personas
        .filter(
          ({ link, document: linked }) =>
            link.contactId === contact.id && linked.projectId !== null,
        )
        .map(({ document: linked }) => ({
          archivedAt: linked.archivedAt?.toISOString() ?? null,
          documentId: linked.id,
          projectId: linked.projectId,
          title: linked.title,
        })),
      revision: contact.revision,
    });
  });
}

async function readContact(
  executor: Pick<Database, "select">,
  workspaceId: string,
  contactId: string,
) {
  const [contact] = await readContacts(executor, workspaceId, [contactId]);
  if (!contact) {
    throw new ContactNotFoundError(contactId);
  }
  return contact;
}

async function readFeedbackIds(
  executor: Pick<Database, "select">,
  contactId: string,
) {
  const rows = await executor
    .select({ feedbackId: workspaceContactFeedback.feedbackId })
    .from(workspaceContactFeedback)
    .where(eq(workspaceContactFeedback.contactId, contactId))
    .orderBy(
      asc(workspaceContactFeedback.createdAt),
      asc(workspaceContactFeedback.feedbackId),
    );
  return rows.map((row) => row.feedbackId);
}

type MergeLinkKind =
  | "affiliation"
  | "email"
  | "feedback"
  | "persona"
  | "redirect";

interface MergeLink {
  attributed: boolean;
  kind: MergeLinkKind;
  value: string;
}

/**
 * Moves the copy's values onto the survivor and returns what it did, so the
 * merge can be undone: `attributed` marks what only this merge put there.
 */
async function mergeIntoSurvivor(
  executor: ContactExecutor,
  workspaceId: string,
  survivor: typeof workspaceContact.$inferSelect,
  retired: typeof workspaceContact.$inferSelect,
  now: Date,
) {
  const [
    retiredEmails,
    retiredPersonas,
    retiredFeedback,
    retiredAffiliations,
    survivorCurrent,
    redirects,
  ] = await Promise.all([
    executor
      .select()
      .from(workspaceContactEmail)
      .where(eq(workspaceContactEmail.contactId, retired.id)),
    executor
      .select()
      .from(workspaceContactPersona)
      .where(eq(workspaceContactPersona.contactId, retired.id)),
    executor
      .select()
      .from(workspaceContactFeedback)
      .where(eq(workspaceContactFeedback.contactId, retired.id)),
    executor
      .select({
        endedAt: workspaceContactCompanyAffiliation.endedAt,
        id: workspaceContactCompanyAffiliation.id,
      })
      .from(workspaceContactCompanyAffiliation)
      .where(eq(workspaceContactCompanyAffiliation.contactId, retired.id)),
    executor
      .select({ id: workspaceContactCompanyAffiliation.id })
      .from(workspaceContactCompanyAffiliation)
      .where(
        and(
          eq(workspaceContactCompanyAffiliation.contactId, survivor.id),
          isNull(workspaceContactCompanyAffiliation.endedAt),
        ),
      )
      .limit(1),
    executor
      .select({ id: workspaceContactRetiredIdentity.id })
      .from(workspaceContactRetiredIdentity)
      .where(
        eq(workspaceContactRetiredIdentity.survivingContactId, retired.id),
      ),
  ]);

  const links: MergeLink[] = [];

  if (retiredEmails.length > 0) {
    const added = await executor
      .insert(workspaceContactEmail)
      .values(
        retiredEmails.map((email) => ({
          contactId: survivor.id,
          id: crypto.randomUUID(),
          normalizedEmail: email.normalizedEmail,
          workspaceId,
        })),
      )
      .onConflictDoNothing()
      .returning({ email: workspaceContactEmail.normalizedEmail });
    const addedEmails = new Set(added.map(({ email }) => email));
    for (const { normalizedEmail } of retiredEmails) {
      links.push({
        attributed: addedEmails.has(normalizedEmail),
        kind: "email",
        value: normalizedEmail,
      });
    }
  }
  if (retiredPersonas.length > 0) {
    const added = await executor
      .insert(workspaceContactPersona)
      .values(
        retiredPersonas.map((persona) => ({
          contactId: survivor.id,
          documentId: persona.documentId,
          id: crypto.randomUUID(),
          workspaceId,
        })),
      )
      .onConflictDoNothing()
      .returning({ documentId: workspaceContactPersona.documentId });
    const addedDocuments = new Set(added.map(({ documentId }) => documentId));
    for (const { documentId } of retiredPersonas) {
      links.push({
        attributed: addedDocuments.has(documentId),
        kind: "persona",
        value: documentId,
      });
    }
  }
  if (retiredFeedback.length > 0) {
    const added = await executor
      .insert(workspaceContactFeedback)
      .values(
        retiredFeedback.map((link) => ({
          contactId: survivor.id,
          feedbackId: link.feedbackId,
          id: crypto.randomUUID(),
          workspaceId,
        })),
      )
      .onConflictDoNothing()
      .returning({ feedbackId: workspaceContactFeedback.feedbackId });
    const addedFeedback = new Set(added.map(({ feedbackId }) => feedbackId));
    for (const { feedbackId } of retiredFeedback) {
      links.push({
        attributed: addedFeedback.has(feedbackId),
        kind: "feedback",
        value: feedbackId,
      });
    }
  }

  // The survivor's current Company wins; the copy's affiliation history moves
  // over, with its open row closed so one current link remains. The copy's
  // current row is the attributed one: undo gives it back as current.
  if (survivorCurrent.length > 0) {
    await closeCurrentAffiliation(executor, retired.id, now);
  }
  await executor
    .update(workspaceContactCompanyAffiliation)
    .set({ contactId: survivor.id })
    .where(eq(workspaceContactCompanyAffiliation.contactId, retired.id));
  for (const affiliation of retiredAffiliations) {
    links.push({
      attributed: affiliation.endedAt === null,
      kind: "affiliation",
      value: affiliation.id,
    });
  }
  for (const redirect of redirects) {
    links.push({ attributed: true, kind: "redirect", value: redirect.id });
  }

  let adoptedDisplayName: string | null = null;
  if (survivor.displayName === null && retired.displayName !== null) {
    adoptedDisplayName = retired.displayName;
    await executor
      .update(workspaceContact)
      .set({ displayName: retired.displayName })
      .where(eq(workspaceContact.id, survivor.id));
  }
  return { adoptedDisplayName, links };
}

/**
 * A repeated confirm after a committed merge returns that merge's result. Only
 * the exact copy-to-survivor pair that was retired matches; anything else is
 * still a missing Contact.
 */
async function replayMerge(
  executor: ContactExecutor,
  workspaceId: string,
  input: ParsedMergeContactsInput,
) {
  const [identity] = await executor
    .select()
    .from(workspaceContactRetiredIdentity)
    .where(
      and(
        eq(workspaceContactRetiredIdentity.id, input.retiredId),
        eq(workspaceContactRetiredIdentity.workspaceId, workspaceId),
        eq(
          workspaceContactRetiredIdentity.survivingContactId,
          input.survivorId,
        ),
      ),
    )
    .limit(1);
  if (!identity) {
    throw new ContactNotFoundError(input.retiredId);
  }
  return mergeResultSchema.parse({
    mergeId: identity.mergeId,
    retiredId: identity.id,
    survivor: await readContact(executor, workspaceId, input.survivorId),
  });
}

async function bumpRevision(
  executor: ContactExecutor,
  contact: typeof workspaceContact.$inferSelect,
  expectedRevision: number | undefined,
) {
  if (expectedRevision !== undefined && expectedRevision !== contact.revision) {
    throw new ContactRevisionConflictError(contact.id);
  }
  await executor
    .update(workspaceContact)
    .set({ revision: contact.revision + 1, updatedAt: new Date() })
    .where(eq(workspaceContact.id, contact.id));
}

async function closeCurrentAffiliation(
  executor: ContactExecutor,
  contactId: string,
  at: Date,
) {
  const [closed] = await executor
    .update(workspaceContactCompanyAffiliation)
    .set({ endedAt: at })
    .where(
      and(
        eq(workspaceContactCompanyAffiliation.contactId, contactId),
        isNull(workspaceContactCompanyAffiliation.endedAt),
      ),
    )
    .returning({
      companyId: workspaceContactCompanyAffiliation.companyId,
    });
  return closed?.companyId ?? null;
}

async function openAffiliation(
  executor: ContactExecutor,
  workspaceId: string,
  contactId: string,
  companyId: string,
  at: Date,
) {
  await executor.insert(workspaceContactCompanyAffiliation).values({
    companyId,
    contactId,
    id: crypto.randomUUID(),
    startedAt: at,
    workspaceId,
  });
}

async function requirePersonaDocument(
  executor: Pick<Database, "select">,
  workspaceId: string,
  documentId: string,
) {
  const [record] = await executor
    .select({ id: document.id })
    .from(document)
    .innerJoin(project, eq(project.id, document.projectId))
    .where(
      and(
        eq(document.id, documentId),
        eq(document.type, "Persona"),
        eq(project.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!record) {
    throw new ContactPersonaDocumentNotFoundError(documentId);
  }
}

interface UndoPlan {
  conflicts: MergeUndoPreview["conflicts"];
  links: (typeof workspaceContactMergeLink.$inferSelect)[];
  merge: typeof workspaceContactMerge.$inferSelect;
  restorableAffiliationIds: string[];
  restorableFeedbackIds: string[];
  restorablePersonaDocuments: MergeUndoPreview["restoredPersonaDocuments"];
  restoredCompany: string | null;
  survivor: typeof workspaceContact.$inferSelect;
  unrestorable: MergeUndoPreview["unrestorable"];
}

async function findOpenMerge(
  executor: Pick<Database, "select">,
  workspaceId: string,
  retiredId: string,
) {
  const [identity] = await executor
    .select({ mergeId: workspaceContactRetiredIdentity.mergeId })
    .from(workspaceContactRetiredIdentity)
    .where(
      and(
        eq(workspaceContactRetiredIdentity.id, retiredId),
        eq(workspaceContactRetiredIdentity.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!identity) {
    return null;
  }
  const [merge] = await executor
    .select()
    .from(workspaceContactMerge)
    .where(
      and(
        eq(workspaceContactMerge.id, identity.mergeId),
        eq(workspaceContactMerge.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return merge ?? null;
}

/**
 * Reads what undo can give back and what no longer exists. A link whose
 * Feedback, Persona Document or Company row is gone (redaction or permanent
 * delete) is counted as unrestorable rather than silently dropped.
 */
async function planUndo(
  executor: Pick<Database, "select">,
  workspaceId: string,
  merge: typeof workspaceContactMerge.$inferSelect,
  survivor: typeof workspaceContact.$inferSelect,
): Promise<UndoPlan> {
  const links = await executor
    .select()
    .from(workspaceContactMergeLink)
    .where(eq(workspaceContactMergeLink.mergeId, merge.id));
  const valuesOf = (kind: MergeLinkKind) =>
    links.filter((link) => link.kind === kind).map((link) => link.value);
  const feedbackIds = valuesOf("feedback");
  const documentIds = valuesOf("persona");
  const affiliationIds = valuesOf("affiliation");

  const [feedbackRows, documentRows, affiliationRows] = await Promise.all([
    feedbackIds.length === 0
      ? []
      : executor
          .select({ id: feedback.id })
          .from(feedback)
          .innerJoin(project, eq(project.id, feedback.projectId))
          .where(
            and(
              inArray(feedback.id, feedbackIds),
              eq(project.workspaceId, workspaceId),
            ),
          ),
    documentIds.length === 0
      ? []
      : executor
          .select({
            archivedAt: document.archivedAt,
            id: document.id,
            projectId: document.projectId,
            title: document.title,
          })
          .from(document)
          .where(inArray(document.id, documentIds)),
    affiliationIds.length === 0
      ? []
      : executor
          .select({
            companyName: workspaceCompany.name,
            id: workspaceContactCompanyAffiliation.id,
          })
          .from(workspaceContactCompanyAffiliation)
          .innerJoin(
            workspaceCompany,
            eq(
              workspaceCompany.id,
              workspaceContactCompanyAffiliation.companyId,
            ),
          )
          .where(
            and(
              inArray(workspaceContactCompanyAffiliation.id, affiliationIds),
              eq(workspaceContactCompanyAffiliation.contactId, survivor.id),
            ),
          ),
  ]);

  const restorablePersonaDocuments = documentRows.flatMap((row) =>
    row.projectId === null
      ? []
      : [
          {
            archivedAt: row.archivedAt?.toISOString() ?? null,
            documentId: row.id,
            projectId: row.projectId,
            title: row.title,
          },
        ],
  );
  const attributedAffiliation = new Set(
    links
      .filter((link) => link.kind === "affiliation" && link.attributed)
      .map((link) => link.value),
  );
  const currentRow = affiliationRows.find((row) =>
    attributedAffiliation.has(row.id),
  );
  const missing = [
    ["Feedback link", feedbackIds.length - feedbackRows.length],
    ["Persona link", documentIds.length - restorablePersonaDocuments.length],
    ["Company link", affiliationIds.length - affiliationRows.length],
  ] as const;
  const adopted = merge.adoptedDisplayName;
  return {
    conflicts:
      adopted !== null && survivor.displayName !== adopted
        ? [
            {
              currentValue: survivor.displayName,
              field: "Display name",
              previousValue: null,
            },
          ]
        : [],
    links,
    merge,
    restorableAffiliationIds: affiliationRows.map((row) => row.id),
    restorableFeedbackIds: feedbackRows.map((row) => row.id),
    restorablePersonaDocuments,
    restoredCompany: currentRow?.companyName ?? null,
    survivor,
    unrestorable: missing.flatMap(([kind, total]) =>
      total > 0 ? [{ count: total, kind }] : [],
    ),
  };
}

function toUndoPreview(plan: UndoPlan, survivor: Contact): MergeUndoPreview {
  return mergeUndoPreviewSchema.parse({
    conflicts: plan.conflicts,
    mergeId: plan.merge.id,
    restoredCompany: plan.restoredCompany,
    restoredDisplayName: plan.merge.retiredDisplayName,
    restoredEmails: plan.links
      .filter((link) => link.kind === "email")
      .map((link) => link.value),
    restoredFeedbackIds: plan.restorableFeedbackIds,
    restoredPersonaDocuments: plan.restorablePersonaDocuments,
    retiredId: plan.merge.retiredContactId,
    survivor,
    unrestorable: plan.unrestorable,
  });
}

/** A repeated confirm after undo returns the restored Contact. */
async function replayUndo(
  executor: ContactExecutor,
  workspaceId: string,
  retiredId: string,
) {
  const [merge] = await executor
    .select()
    .from(workspaceContactMerge)
    .where(
      and(
        eq(workspaceContactMerge.retiredContactId, retiredId),
        eq(workspaceContactMerge.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(workspaceContactMerge.mergedAt))
    .limit(1);
  const [live] = await readContacts(executor, workspaceId, [retiredId]);
  if (!(merge?.undoneAt && live)) {
    throw new ContactMergeNotFoundError(retiredId);
  }
  return undoMergeResultSchema.parse({
    mergeId: merge.id,
    restored: live,
    survivor: await readContact(
      executor,
      workspaceId,
      merge.survivingContactId,
    ),
    unrestorable: [],
  });
}

async function undoMergeInTransaction(
  executor: ContactExecutor,
  workspaceId: string,
  input: ParsedUndoMergeInput,
  actorAccountId: string,
) {
  const merge = await findOpenMerge(executor, workspaceId, input.retiredId);
  if (!merge) {
    return replayUndo(executor, workspaceId, input.retiredId);
  }
  const survivor = await findLockedContact(
    executor,
    workspaceId,
    merge.survivingContactId,
  );
  if (!survivor) {
    throw new ContactMergeUndoBlockedError(merge.survivingContactId);
  }
  if (
    input.expectedSurvivorRevision !== undefined &&
    input.expectedSurvivorRevision !== survivor.revision
  ) {
    throw new ContactRevisionConflictError(survivor.id);
  }
  const plan = await planUndo(executor, workspaceId, merge, survivor);
  if (plan.conflicts.length > 0 && !input.resolutions?.displayName) {
    throw new ContactMergeUndoConflictError(
      plan.conflicts.map((conflict) => conflict.field),
    );
  }

  const retiredId = merge.retiredContactId;
  const now = new Date();
  const attributed = (kind: MergeLinkKind) =>
    plan.links
      .filter((link) => link.kind === kind && link.attributed)
      .map((link) => link.value);
  const all = (kind: MergeLinkKind) =>
    plan.links.filter((link) => link.kind === kind).map((link) => link.value);

  await executor
    .delete(workspaceContactRetiredIdentity)
    .where(eq(workspaceContactRetiredIdentity.id, retiredId));
  await executor.insert(workspaceContact).values({
    archivedAt: merge.retiredArchivedAt,
    createdAt: merge.retiredCreatedAt,
    displayName: merge.retiredDisplayName,
    id: retiredId,
    revision: merge.retiredRevision + 1,
    updatedAt: now,
    workspaceId,
  });

  const emails = all("email");
  if (emails.length > 0) {
    await executor.insert(workspaceContactEmail).values(
      emails.map((normalizedEmail) => ({
        contactId: retiredId,
        id: crypto.randomUUID(),
        normalizedEmail,
        workspaceId,
      })),
    );
  }
  const attributedEmails = attributed("email");
  if (attributedEmails.length > 0) {
    await executor
      .delete(workspaceContactEmail)
      .where(
        and(
          eq(workspaceContactEmail.contactId, survivor.id),
          inArray(workspaceContactEmail.normalizedEmail, attributedEmails),
        ),
      );
  }

  if (plan.restorableFeedbackIds.length > 0) {
    await executor.insert(workspaceContactFeedback).values(
      plan.restorableFeedbackIds.map((feedbackId) => ({
        contactId: retiredId,
        feedbackId,
        id: crypto.randomUUID(),
        workspaceId,
      })),
    );
  }
  const attributedFeedback = attributed("feedback");
  if (attributedFeedback.length > 0) {
    await executor
      .delete(workspaceContactFeedback)
      .where(
        and(
          eq(workspaceContactFeedback.contactId, survivor.id),
          inArray(workspaceContactFeedback.feedbackId, attributedFeedback),
        ),
      );
  }

  if (plan.restorablePersonaDocuments.length > 0) {
    await executor.insert(workspaceContactPersona).values(
      plan.restorablePersonaDocuments.map((persona) => ({
        contactId: retiredId,
        documentId: persona.documentId,
        id: crypto.randomUUID(),
        workspaceId,
      })),
    );
  }
  const attributedPersonas = attributed("persona");
  if (attributedPersonas.length > 0) {
    await executor
      .delete(workspaceContactPersona)
      .where(
        and(
          eq(workspaceContactPersona.contactId, survivor.id),
          inArray(workspaceContactPersona.documentId, attributedPersonas),
        ),
      );
  }

  // History rows go home; the copy's own current Company is reopened. The
  // survivor's later Company changes are separate rows and stay.
  const attributedAffiliations = new Set(attributed("affiliation"));
  const closedHistory = plan.restorableAffiliationIds.filter(
    (id) => !attributedAffiliations.has(id),
  );
  const current = plan.restorableAffiliationIds.filter((id) =>
    attributedAffiliations.has(id),
  );
  if (closedHistory.length > 0) {
    await executor
      .update(workspaceContactCompanyAffiliation)
      .set({ contactId: retiredId })
      .where(inArray(workspaceContactCompanyAffiliation.id, closedHistory));
  }
  if (current.length > 0) {
    await executor
      .update(workspaceContactCompanyAffiliation)
      .set({ contactId: retiredId, endedAt: null })
      .where(inArray(workspaceContactCompanyAffiliation.id, current));
  }

  const redirects = all("redirect");
  if (redirects.length > 0) {
    await executor
      .update(workspaceContactRetiredIdentity)
      .set({ survivingContactId: retiredId })
      .where(
        and(
          inArray(workspaceContactRetiredIdentity.id, redirects),
          eq(workspaceContactRetiredIdentity.survivingContactId, survivor.id),
        ),
      );
  }

  const adopted = merge.adoptedDisplayName;
  if (
    adopted !== null &&
    (plan.conflicts.length === 0 ||
      input.resolutions?.displayName === "Restore previous value")
  ) {
    await executor
      .update(workspaceContact)
      .set({ displayName: null })
      .where(eq(workspaceContact.id, survivor.id));
  }
  await bumpRevision(executor, survivor, undefined);
  await executor
    .update(workspaceContactMerge)
    .set({ undoneAt: now })
    .where(eq(workspaceContactMerge.id, merge.id));
  await executor.insert(workspaceContactAuditEvent).values({
    actorAlias: await accountActorAlias(actorAccountId),
    eventType: "contact.merge_undone",
    id: crypto.randomUUID(),
    mergeId: merge.id,
    occurredAt: now,
    retiredContactId: retiredId,
    survivingContactId: survivor.id,
    workspaceId,
  });
  return undoMergeResultSchema.parse({
    mergeId: merge.id,
    restored: await readContact(executor, workspaceId, retiredId),
    survivor: await readContact(executor, workspaceId, survivor.id),
    unrestorable: plan.unrestorable,
  });
}

export function createDatabaseContactStore(database: Database): ContactStore {
  return {
    async createCompany(workspaceId, input) {
      const [created] = await database
        .insert(workspaceCompany)
        .values({ id: crypto.randomUUID(), name: input.name, workspaceId })
        .returning();
      if (!created) {
        throw new Error("Company was not created.");
      }
      return toCompany(created, 0);
    },

    createContact(workspaceId, input) {
      return database.transaction(async (executor) => {
        if (input.companyId) {
          await requireCompany(executor, workspaceId, input.companyId);
        }
        const contactId = crypto.randomUUID();
        const now = new Date();
        await executor.insert(workspaceContact).values({
          createdAt: now,
          displayName: input.displayName ?? null,
          id: contactId,
          updatedAt: now,
          workspaceId,
        });
        if (input.email) {
          await executor.insert(workspaceContactEmail).values({
            contactId,
            id: crypto.randomUUID(),
            normalizedEmail: input.email,
            workspaceId,
          });
        }
        if (input.companyId) {
          await openAffiliation(
            executor,
            workspaceId,
            contactId,
            input.companyId,
            now,
          );
        }
        return readContact(executor, workspaceId, contactId);
      });
    },

    findWorkspaceId: (accountId) => findWorkspaceId(database, accountId),

    getContact: (workspaceId, contactId) =>
      readContact(database, workspaceId, contactId),

    linkFeedback(workspaceId, input) {
      return database.transaction(async (executor) => {
        const contact = await lockContact(
          executor,
          workspaceId,
          input.contactId,
        );
        const [linked] = await executor
          .select({ id: feedback.id })
          .from(feedback)
          .innerJoin(project, eq(project.id, feedback.projectId))
          .where(
            and(
              eq(feedback.id, input.feedbackId),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (!linked) {
          throw new ContactFeedbackNotFoundError(input.feedbackId);
        }
        await executor
          .insert(workspaceContactFeedback)
          .values({
            contactId: contact.id,
            feedbackId: input.feedbackId,
            id: crypto.randomUUID(),
            workspaceId,
          })
          .onConflictDoNothing();
        return readFeedbackIds(executor, contact.id);
      });
    },

    mergeContacts(workspaceId, input, actorAccountId) {
      return database.transaction(async (executor) => {
        // Lock in id order so two opposite merges cannot deadlock. A copy that
        // is already retired has no live row, so it is replayed, not re-merged.
        const [first, second] = [input.survivorId, input.retiredId].sort();
        const locked = [
          await findLockedContact(executor, workspaceId, first as string),
          await findLockedContact(executor, workspaceId, second as string),
        ].filter((record) => record !== undefined);
        const survivor = locked.find(({ id }) => id === input.survivorId);
        const retired = locked.find(({ id }) => id === input.retiredId);
        if (!survivor) {
          throw new ContactNotFoundError(input.survivorId);
        }
        if (!retired) {
          return replayMerge(executor, workspaceId, input);
        }
        const survivorStale =
          input.expectedSurvivorRevision !== undefined &&
          input.expectedSurvivorRevision !== survivor.revision;
        const retiredStale =
          input.expectedRetiredRevision !== undefined &&
          input.expectedRetiredRevision !== retired.revision;
        if (survivorStale || retiredStale) {
          throw new ContactRevisionConflictError(
            survivorStale ? survivor.id : retired.id,
          );
        }

        const now = new Date();
        const mergeId = crypto.randomUUID();
        const { adoptedDisplayName, links } = await mergeIntoSurvivor(
          executor,
          workspaceId,
          survivor,
          retired,
          now,
        );
        await executor.insert(workspaceContactMerge).values({
          adoptedDisplayName,
          id: mergeId,
          mergedAt: now,
          retiredArchivedAt: retired.archivedAt,
          retiredContactId: retired.id,
          retiredCreatedAt: retired.createdAt,
          retiredDisplayName: retired.displayName,
          retiredRevision: retired.revision,
          survivingContactId: survivor.id,
          workspaceId,
        });
        if (links.length > 0) {
          await executor.insert(workspaceContactMergeLink).values(
            links.map((link) => ({
              ...link,
              id: crypto.randomUUID(),
              mergeId,
            })),
          );
        }
        // Redirects that already pointed at the copy follow the survivor.
        await executor
          .update(workspaceContactRetiredIdentity)
          .set({ survivingContactId: survivor.id })
          .where(
            eq(workspaceContactRetiredIdentity.survivingContactId, retired.id),
          );
        await executor.insert(workspaceContactRetiredIdentity).values({
          id: retired.id,
          mergeId,
          retiredAt: now,
          survivingContactId: survivor.id,
          workspaceId,
        });
        await executor
          .delete(workspaceContact)
          .where(eq(workspaceContact.id, retired.id));
        await bumpRevision(executor, survivor, undefined);
        await executor.insert(workspaceContactAuditEvent).values({
          actorAlias: await accountActorAlias(actorAccountId),
          eventType: "contact.merged",
          id: crypto.randomUUID(),
          mergeId,
          occurredAt: now,
          retiredContactId: retired.id,
          survivingContactId: survivor.id,
          workspaceId,
        });
        return mergeResultSchema.parse({
          mergeId,
          retiredId: retired.id,
          survivor: await readContact(executor, workspaceId, survivor.id),
        });
      });
    },

    async previewMergeUndo(workspaceId, input) {
      const merge = await findOpenMerge(database, workspaceId, input.retiredId);
      if (!merge) {
        throw new ContactMergeNotFoundError(input.retiredId);
      }
      const [survivor] = await database
        .select()
        .from(workspaceContact)
        .where(
          and(
            eq(workspaceContact.id, merge.survivingContactId),
            eq(workspaceContact.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!survivor) {
        throw new ContactMergeUndoBlockedError(merge.survivingContactId);
      }
      return toUndoPreview(
        await planUndo(database, workspaceId, merge, survivor),
        await readContact(database, workspaceId, survivor.id),
      );
    },

    async readMergeInputs(workspaceId, input) {
      const [survivor, retired] = await Promise.all([
        readContact(database, workspaceId, input.survivorId),
        readContact(database, workspaceId, input.retiredId),
      ]);
      const [survivorFeedbackIds, retiredFeedbackIds] = await Promise.all([
        readFeedbackIds(database, survivor.id),
        readFeedbackIds(database, retired.id),
      ]);
      return { retired, retiredFeedbackIds, survivor, survivorFeedbackIds };
    },

    async resolveContact(workspaceId, contactId) {
      const [live] = await readContacts(database, workspaceId, [contactId]);
      let redirectedFrom: string | null = null;
      let resolvedId = contactId;
      if (!live) {
        const [retired] = await database
          .select()
          .from(workspaceContactRetiredIdentity)
          .where(
            and(
              eq(workspaceContactRetiredIdentity.id, contactId),
              eq(workspaceContactRetiredIdentity.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (!retired) {
          throw new ContactNotFoundError(contactId);
        }
        redirectedFrom = retired.id;
        resolvedId = retired.survivingContactId;
      }
      return contactResolutionSchema.parse({
        contact: live ?? (await readContact(database, workspaceId, resolvedId)),
        feedbackIds: await readFeedbackIds(database, resolvedId),
        redirectedFrom,
      });
    },

    linkPersona(workspaceId, input) {
      return database.transaction(async (executor) => {
        const contact = await lockContact(
          executor,
          workspaceId,
          input.contactId,
        );
        await requirePersonaDocument(executor, workspaceId, input.documentId);
        const [inserted] = await executor
          .insert(workspaceContactPersona)
          .values({
            contactId: contact.id,
            documentId: input.documentId,
            id: crypto.randomUUID(),
            workspaceId,
          })
          .onConflictDoNothing()
          .returning({ id: workspaceContactPersona.id });
        if (inserted) {
          await bumpRevision(executor, contact, undefined);
        }
        return readContact(executor, workspaceId, contact.id);
      });
    },

    async listCompanies(workspaceId) {
      const rows = await database
        .select()
        .from(workspaceCompany)
        .where(eq(workspaceCompany.workspaceId, workspaceId))
        .orderBy(asc(workspaceCompany.name), asc(workspaceCompany.id));
      const counts = await database
        .select({
          companyId: workspaceContactCompanyAffiliation.companyId,
          total: count(),
        })
        .from(workspaceContactCompanyAffiliation)
        .where(
          and(
            eq(workspaceContactCompanyAffiliation.workspaceId, workspaceId),
            isNull(workspaceContactCompanyAffiliation.endedAt),
          ),
        )
        .groupBy(workspaceContactCompanyAffiliation.companyId);
      const totals = new Map(counts.map((row) => [row.companyId, row.total]));
      return rows.map((row) => toCompany(row, totals.get(row.id) ?? 0));
    },

    listContacts: (workspaceId) => readContacts(database, workspaceId),

    setCompany(workspaceId, input) {
      return database.transaction(async (executor) => {
        const contact = await lockContact(
          executor,
          workspaceId,
          input.contactId,
        );
        if (input.companyId) {
          await requireCompany(executor, workspaceId, input.companyId);
        }
        const [current] = await executor
          .select({ companyId: workspaceContactCompanyAffiliation.companyId })
          .from(workspaceContactCompanyAffiliation)
          .where(
            and(
              eq(workspaceContactCompanyAffiliation.contactId, contact.id),
              isNull(workspaceContactCompanyAffiliation.endedAt),
            ),
          )
          .limit(1);
        if ((current?.companyId ?? null) === input.companyId) {
          return readContact(executor, workspaceId, contact.id);
        }
        const now = new Date();
        await bumpRevision(executor, contact, input.expectedRevision);
        await closeCurrentAffiliation(executor, contact.id, now);
        if (input.companyId) {
          await openAffiliation(
            executor,
            workspaceId,
            contact.id,
            input.companyId,
            now,
          );
        }
        return readContact(executor, workspaceId, contact.id);
      });
    },

    undoMerge(workspaceId, input, actorAccountId) {
      return database.transaction((executor) =>
        undoMergeInTransaction(executor, workspaceId, input, actorAccountId),
      );
    },

    unlinkPersona(workspaceId, input) {
      return database.transaction(async (executor) => {
        const contact = await lockContact(
          executor,
          workspaceId,
          input.contactId,
        );
        const removed = await executor
          .delete(workspaceContactPersona)
          .where(
            and(
              eq(workspaceContactPersona.contactId, contact.id),
              eq(workspaceContactPersona.documentId, input.documentId),
            ),
          )
          .returning({ id: workspaceContactPersona.id });
        if (removed.length > 0) {
          await bumpRevision(executor, contact, undefined);
        }
        return readContact(executor, workspaceId, contact.id);
      });
    },

    updateContact(workspaceId, input) {
      return database.transaction(async (executor) => {
        const contact = await lockContact(
          executor,
          workspaceId,
          input.contactId,
        );
        if (
          input.expectedRevision !== undefined &&
          input.expectedRevision !== contact.revision
        ) {
          throw new ContactRevisionConflictError(contact.id);
        }
        let changed = false;
        if (
          input.displayName !== undefined &&
          input.displayName !== contact.displayName
        ) {
          await executor
            .update(workspaceContact)
            .set({ displayName: input.displayName })
            .where(eq(workspaceContact.id, contact.id));
          changed = true;
        }
        if (input.email) {
          const [added] = await executor
            .insert(workspaceContactEmail)
            .values({
              contactId: contact.id,
              id: crypto.randomUUID(),
              normalizedEmail: input.email,
              workspaceId,
            })
            .onConflictDoNothing()
            .returning({ id: workspaceContactEmail.id });
          changed = changed || added !== undefined;
        }
        if (changed) {
          await bumpRevision(executor, contact, undefined);
        }
        return readContact(executor, workspaceId, contact.id);
      });
    },
  };
}

export function createDatabaseContacts(database: Database) {
  return createContacts({ store: createDatabaseContactStore(database) });
}
