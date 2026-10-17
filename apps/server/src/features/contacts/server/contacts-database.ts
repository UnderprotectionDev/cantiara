import {
  type Company,
  type Contact,
  type ContactStore,
  companySchema,
  contactSchema,
} from "@cantiara/api/contacts";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceCompany,
  workspaceContact,
  workspaceContactCompanyAffiliation,
  workspaceContactEmail,
  workspaceContactPersona,
} from "@cantiara/db/schema/contact";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  CompanyNotFoundError,
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

async function lockContact(
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
  };
}

export function createDatabaseContacts(database: Database) {
  return createContacts({ store: createDatabaseContactStore(database) });
}
