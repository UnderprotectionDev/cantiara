import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
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
});
