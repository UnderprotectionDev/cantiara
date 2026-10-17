import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  workspaceContactAuditEvent,
  workspaceContactRetiredIdentity,
} from "@cantiara/db/schema/contact";
import { document } from "@cantiara/db/schema/document";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { feedback } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  CompanyNotFoundError,
  ContactNotFoundError,
  ContactPersonaDocumentNotFoundError,
  ContactRevisionConflictError,
} from "./contacts";
import { createDatabaseContacts } from "./contacts-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Contact and Company PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `contacts-${crypto.randomUUID()}`;
  const otherAccountId = `contacts-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-${crypto.randomUUID()}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  async function insertDocument(
    owningProjectId: string,
    type: string,
    title: string,
  ) {
    const id = `document-${crypto.randomUUID()}`;
    await requireDatabase().insert(document).values({
      body: "# Persona",
      id,
      projectId: owningProjectId,
      title,
      type,
    });
    return id;
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await db.insert(project).values({
      shortCode: `CON-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      id: projectId,
      name: "Contacts",
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await db.insert(project).values({
      shortCode: `OTH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      id: otherProjectId,
      name: "Other",
      starterConfiguration: "Blank Project",
      workspaceId: otherWorkspaceId,
    });
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("creates Workspace-scoped Contacts with optional name, email and Company", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const company = await access.createCompany(accountId, { name: "Acme" });

    const bare = await access.createContact(accountId, {});
    const full = await access.createContact(accountId, {
      companyId: company.id,
      displayName: "Ada",
      email: "Ada@Example.com",
    });

    expect(bare).toMatchObject({
      company: null,
      displayName: null,
      emails: [],
      personaDocuments: [],
    });
    expect(full).toMatchObject({
      company: { id: company.id, name: "Acme" },
      displayName: "Ada",
      emails: ["ada@example.com"],
    });
    expect((await access.listContacts(accountId)).map(({ id }) => id)).toEqual(
      expect.arrayContaining([bare.id, full.id]),
    );
    expect((await access.listCompanies(accountId))[0]).toMatchObject({
      contactCount: 1,
      name: "Acme",
    });
    expect(await access.listContacts(otherAccountId)).toEqual([]);
    await expect(
      access.getContact(otherAccountId, { contactId: full.id }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);
  });

  test("keeps duplicate emails as separate identities", async () => {
    const access = createDatabaseContacts(requireDatabase());

    const first = await access.createContact(accountId, {
      email: "same@example.com",
    });
    const second = await access.createContact(accountId, {
      email: "SAME@example.com",
    });

    expect(second.id).not.toBe(first.id);
    expect(second.emails).toEqual(first.emails);
  });

  test("allows one current Company and keeps past affiliations", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const acme = await access.createCompany(accountId, { name: "Acme" });
    const globex = await access.createCompany(accountId, { name: "Globex" });
    const contact = await access.createContact(accountId, {
      companyId: acme.id,
    });

    const moved = await access.setCompany(accountId, {
      companyId: globex.id,
      contactId: contact.id,
      expectedRevision: contact.revision,
    });
    const cleared = await access.setCompany(accountId, {
      companyId: null,
      contactId: contact.id,
    });
    const unchanged = await access.setCompany(accountId, {
      companyId: null,
      contactId: contact.id,
    });

    expect(moved.company?.name).toBe("Globex");
    expect(cleared.company).toBeNull();
    expect(cleared.companyHistory.map((entry) => entry.company.name)).toEqual([
      "Acme",
      "Globex",
    ]);
    expect(
      cleared.companyHistory.every((entry) => entry.endedAt !== null),
    ).toBe(true);
    expect(unchanged.revision).toBe(cleared.revision);
    await expect(
      access.setCompany(accountId, {
        companyId: acme.id,
        contactId: contact.id,
        expectedRevision: contact.revision,
      }),
    ).rejects.toBeInstanceOf(ContactRevisionConflictError);
  });

  test("adds a display name and email alias later and keeps the stale-revision guard", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const contact = await access.createContact(accountId, {});

    const updated = await access.updateContact(accountId, {
      contactId: contact.id,
      displayName: "Grace",
      email: "Grace@Example.com",
      expectedRevision: contact.revision,
    });
    const repeated = await access.updateContact(accountId, {
      contactId: contact.id,
      email: "grace@example.com",
    });

    expect(updated).toMatchObject({
      displayName: "Grace",
      emails: ["grace@example.com"],
      id: contact.id,
      revision: contact.revision + 1,
    });
    expect(repeated.revision).toBe(updated.revision);
    await expect(
      access.updateContact(accountId, {
        contactId: contact.id,
        displayName: null,
        expectedRevision: contact.revision,
      }),
    ).rejects.toBeInstanceOf(ContactRevisionConflictError);
  });

  test("rejects a Company from another Workspace", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const foreign = await access.createCompany(otherAccountId, {
      name: "Foreign",
    });

    await expect(
      access.createContact(accountId, { companyId: foreign.id }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
  });

  test("never assigns a Persona automatically and links only an explicit Persona Document", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const personaId = await insertDocument(projectId, "Persona", "Maker Mia");
    const generalId = await insertDocument(projectId, "General", "Notes");
    const foreignPersonaId = await insertDocument(
      otherProjectId,
      "Persona",
      "Foreign",
    );

    const contact = await access.createContact(accountId, {
      displayName: "Mia",
      email: "mia@example.com",
    });
    expect(contact.personaDocuments).toEqual([]);
    expect(
      (await access.getContact(accountId, { contactId: contact.id }))
        .personaDocuments,
    ).toEqual([]);

    await Promise.all(
      [generalId, foreignPersonaId].map((documentId) =>
        expect(
          access.linkPersona(accountId, { contactId: contact.id, documentId }),
        ).rejects.toBeInstanceOf(ContactPersonaDocumentNotFoundError),
      ),
    );

    const linked = await access.linkPersona(accountId, {
      contactId: contact.id,
      documentId: personaId,
    });
    const repeated = await access.linkPersona(accountId, {
      contactId: contact.id,
      documentId: personaId,
    });
    expect(linked.personaDocuments).toEqual([
      {
        archivedAt: null,
        documentId: personaId,
        projectId,
        title: "Maker Mia",
      },
    ]);
    expect(repeated.revision).toBe(linked.revision);

    const unlinked = await access.unlinkPersona(accountId, {
      contactId: contact.id,
      documentId: personaId,
    });
    expect(unlinked.personaDocuments).toEqual([]);
  });

  async function insertFeedback(owningProjectId: string, title: string) {
    const id = `feedback-${crypto.randomUUID()}`;
    await requireDatabase().insert(feedback).values({
      id,
      occurredAt: new Date(),
      originalMessage: "Customer finding",
      projectId: owningProjectId,
      title,
    });
    return id;
  }

  async function seedDuplicates() {
    const access = createDatabaseContacts(requireDatabase());
    const acme = await access.createCompany(accountId, { name: "Acme" });
    const survivor = await access.createContact(accountId, {
      displayName: "Ada",
      email: "ada@example.com",
    });
    const retired = await access.createContact(accountId, {
      companyId: acme.id,
      displayName: "Ada L.",
      email: "ada@example.com",
    });
    await access.updateContact(accountId, {
      contactId: retired.id,
      email: "ada@work.example",
    });
    const personaId = await insertDocument(projectId, "Persona", "Maker Mia");
    await access.linkPersona(accountId, {
      contactId: retired.id,
      documentId: personaId,
    });
    const feedbackId = await insertFeedback(projectId, "Retired feedback");
    await access.linkFeedback(accountId, {
      contactId: retired.id,
      feedbackId,
    });
    return { access, acme, feedbackId, personaId, retired, survivor };
  }

  test("previews a merge without writing anything", async () => {
    const { access, feedbackId, personaId, retired, survivor } =
      await seedDuplicates();
    const before = await access.listContacts(accountId);

    const preview = await access.previewMerge(accountId, {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(preview.fieldConflicts).toEqual([
      { field: "Display name", retiredValue: "Ada L.", survivorValue: "Ada" },
    ]);
    expect(preview.addedEmails).toEqual(["ada@work.example"]);
    expect(preview.companyOutcome).toBe("Adopt retired");
    expect(preview.feedbackIds).toEqual([feedbackId]);
    expect(preview.personaDocuments.map((p) => p.documentId)).toEqual([
      personaId,
    ]);
    expect(await access.listContacts(accountId)).toEqual(before);
    expect(
      await requireDatabase().select().from(workspaceContactRetiredIdentity),
    ).toEqual([]);
  });

  test("confirms a merge atomically onto one surviving Contact", async () => {
    const { access, acme, feedbackId, personaId, retired, survivor } =
      await seedDuplicates();

    const result = await access.mergeContacts(accountId, {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(result.survivor).toMatchObject({
      company: { id: acme.id },
      displayName: "Ada",
      emails: ["ada@example.com", "ada@work.example"],
      id: survivor.id,
    });
    expect(result.survivor.personaDocuments.map((p) => p.documentId)).toEqual([
      personaId,
    ]);
    expect(
      result.survivor.companyHistory.filter((entry) => entry.endedAt === null),
    ).toHaveLength(1);
    const live = await access.listContacts(accountId);
    expect(live.map(({ id }) => id)).toEqual([survivor.id]);
    await expect(
      access.getContact(accountId, { contactId: retired.id }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);
    const resolved = await access.resolveContact(accountId, {
      contactId: retired.id,
    });
    expect(resolved).toMatchObject({
      contact: { id: survivor.id },
      feedbackIds: [feedbackId],
      redirectedFrom: retired.id,
    });
    expect(
      (await access.resolveContact(accountId, { contactId: survivor.id }))
        .redirectedFrom,
    ).toBeNull();
    expect(await access.listDuplicateCandidates(accountId)).toEqual([]);
  });

  test("fills a missing display name from the copy but never overwrites the survivor's", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const survivor = await access.createContact(accountId, {});
    const retired = await access.createContact(accountId, {
      displayName: "Grace",
    });

    const result = await access.mergeContacts(accountId, {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(result.survivor.displayName).toBe("Grace");
  });

  test("keeps Feedback reachable and does not touch evidence or priority data", async () => {
    const { access, feedbackId, retired, survivor } = await seedDuplicates();
    const db = requireDatabase();
    const feedbackBefore = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId));

    await access.mergeContacts(accountId, {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(
      (await access.resolveContact(accountId, { contactId: survivor.id }))
        .feedbackIds,
    ).toEqual([feedbackId]);
    expect(
      await db.select().from(feedback).where(eq(feedback.id, feedbackId)),
    ).toEqual(feedbackBefore);
    expect(
      await db
        .select()
        .from(evidenceBinding)
        .where(eq(evidenceBinding.workspaceId, workspaceId)),
    ).toEqual([]);
  });

  test("keeps a retired identity contentless and follows chained merges", async () => {
    const access = createDatabaseContacts(requireDatabase());
    const first = await access.createContact(accountId, { email: "a@x.test" });
    const second = await access.createContact(accountId, { email: "b@x.test" });
    const third = await access.createContact(accountId, { email: "c@x.test" });
    await access.mergeContacts(accountId, {
      retiredId: first.id,
      survivorId: second.id,
    });
    await access.mergeContacts(accountId, {
      retiredId: second.id,
      survivorId: third.id,
    });

    const viaFirst = await access.resolveContact(accountId, {
      contactId: first.id,
    });
    expect(viaFirst.contact.id).toBe(third.id);
    expect(viaFirst.redirectedFrom).toBe(first.id);
    const [row] = await requireDatabase()
      .select()
      .from(workspaceContactRetiredIdentity)
      .where(eq(workspaceContactRetiredIdentity.id, first.id));
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "id",
      "mergeId",
      "retiredAt",
      "survivingContactId",
      "workspaceId",
    ]);
    await expect(
      access.mergeContacts(accountId, {
        retiredId: third.id,
        survivorId: first.id,
      }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);
    expect(await access.listContacts(otherAccountId)).toEqual([]);
    await expect(
      access.resolveContact(otherAccountId, { contactId: first.id }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);
  });

  test("rolls the whole merge back when it fails", async () => {
    const { access, retired, survivor } = await seedDuplicates();
    const before = await access.listContacts(accountId);

    await expect(
      access.mergeContacts(accountId, {
        expectedSurvivorRevision: survivor.revision + 5,
        retiredId: retired.id,
        survivorId: survivor.id,
      }),
    ).rejects.toBeInstanceOf(ContactRevisionConflictError);

    expect(await access.listContacts(accountId)).toEqual(before);
    expect(
      await requireDatabase().select().from(workspaceContactRetiredIdentity),
    ).toEqual([]);
  });

  test("records an audit event with aliased ids, actor and time but no raw email", async () => {
    const { access, retired, survivor } = await seedDuplicates();

    await access.mergeContacts(accountId, {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    const events = await requireDatabase()
      .select()
      .from(workspaceContactAuditEvent)
      .where(eq(workspaceContactAuditEvent.workspaceId, workspaceId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorAccountId: accountId,
      eventType: "contact.merged",
      retiredContactId: retired.id,
      survivingContactId: survivor.id,
    });
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain("Ada");
  });
});
