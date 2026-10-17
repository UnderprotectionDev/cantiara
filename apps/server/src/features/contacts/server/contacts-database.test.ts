import { createHash } from "node:crypto";

import type { MergeUndoResolution } from "@cantiara/api/contacts";
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
  ContactMergeNotFoundError,
  ContactMergeUndoBlockedError,
  ContactMergeUndoConflictError,
  ContactMergeUndoPayloadChangedError,
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
      await requireDatabase()
        .select()
        .from(workspaceContactRetiredIdentity)
        .where(eq(workspaceContactRetiredIdentity.workspaceId, workspaceId)),
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
      await requireDatabase()
        .select()
        .from(workspaceContactRetiredIdentity)
        .where(eq(workspaceContactRetiredIdentity.workspaceId, workspaceId)),
    ).toEqual([]);
  });

  test("records an audit event with an actor alias, opaque ids and time but no raw email", async () => {
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
      actorAlias: `account:${createHash("sha256").update(accountId).digest("hex")}`,
      eventType: "contact.merged",
      retiredContactId: retired.id,
      survivingContactId: survivor.id,
    });
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(accountId);
    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain("Ada");
  });

  test("names the copy as the stale side when only its revision is sent", async () => {
    const { access, retired, survivor } = await seedDuplicates();
    const current = await access.getContact(accountId, {
      contactId: retired.id,
    });
    await access.updateContact(accountId, {
      contactId: retired.id,
      displayName: "Ada L. Work",
      expectedRevision: current.revision,
    });

    await expect(
      access.mergeContacts(accountId, {
        expectedRetiredRevision: current.revision,
        retiredId: retired.id,
        survivorId: survivor.id,
      }),
    ).rejects.toThrow(`Contact ${retired.id} changed since it was loaded.`);
  });

  test("replays a confirmed merge with the same result instead of failing on the retired copy", async () => {
    const { access, retired, survivor } = await seedDuplicates();
    const input = { retiredId: retired.id, survivorId: survivor.id };
    const first = await access.mergeContacts(accountId, input);

    const replay = await access.mergeContacts(accountId, input);

    expect(replay.mergeId).toBe(first.mergeId);
    expect(replay.retiredId).toBe(retired.id);
    expect(replay.survivor.id).toBe(survivor.id);
    expect(
      await requireDatabase()
        .select()
        .from(workspaceContactAuditEvent)
        .where(eq(workspaceContactAuditEvent.workspaceId, workspaceId)),
    ).toHaveLength(1);
  });

  test("does not replay a merge of a retired copy onto a different survivor", async () => {
    const { access, retired, survivor } = await seedDuplicates();
    await access.mergeContacts(accountId, {
      retiredId: retired.id,
      survivorId: survivor.id,
    });
    const other = await access.createContact(accountId, {
      displayName: "Other",
    });

    await expect(
      access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: other.id,
      }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);
  });

  describe("Merge undo", () => {
    async function confirmUndo(
      access: ReturnType<typeof createDatabaseContacts>,
      retiredId: string,
      displayName?: MergeUndoResolution,
    ) {
      const preview = await access.previewMergeUndo(accountId, { retiredId });
      return access.undoMerge(accountId, {
        expectedSurvivorRevision: preview.survivor.revision,
        ...(displayName ? { resolutions: { displayName } } : {}),
        retiredId,
      });
    }

    test("restores the retired identity and splits back only merge-attributed values", async () => {
      const { access, acme, feedbackId, personaId, retired, survivor } =
        await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });

      const result = await confirmUndo(access, retired.id);

      expect(result.unrestorable).toEqual([]);
      expect(result.restored).toMatchObject({
        company: { id: acme.id },
        displayName: "Ada L.",
        emails: ["ada@example.com", "ada@work.example"],
        id: retired.id,
      });
      expect(result.restored.personaDocuments.map((p) => p.documentId)).toEqual(
        [personaId],
      );
      expect(result.survivor).toMatchObject({
        company: null,
        displayName: "Ada",
        emails: ["ada@example.com"],
        personaDocuments: [],
      });
      const live = await access.listContacts(accountId);
      expect(live.map(({ id }) => id).sort()).toEqual(
        [retired.id, survivor.id].sort(),
      );
      const reopened = await access.resolveContact(accountId, {
        contactId: retired.id,
      });
      expect(reopened).toMatchObject({
        contact: { id: retired.id },
        feedbackIds: [feedbackId],
        redirectedFrom: null,
      });
      expect(
        (await access.resolveContact(accountId, { contactId: survivor.id }))
          .feedbackIds,
      ).toEqual([]);
      expect(
        await requireDatabase()
          .select()
          .from(workspaceContactRetiredIdentity)
          .where(eq(workspaceContactRetiredIdentity.workspaceId, workspaceId)),
      ).toEqual([]);
      const events = await requireDatabase()
        .select()
        .from(workspaceContactAuditEvent)
        .where(eq(workspaceContactAuditEvent.workspaceId, workspaceId));
      expect(events.map((event) => event.eventType).sort()).toEqual([
        "contact.merge_undone",
        "contact.merged",
      ]);
      expect(JSON.stringify(events)).not.toContain("ada@");
    });

    test("does not rewind unrelated edits made after the merge", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      await access.updateContact(accountId, {
        contactId: survivor.id,
        displayName: "Ada Lovelace",
        email: "late@example.com",
      });
      const lateFeedback = await insertFeedback(projectId, "Late feedback");
      await access.linkFeedback(accountId, {
        contactId: survivor.id,
        feedbackId: lateFeedback,
      });
      const lateCompany = await access.createCompany(accountId, {
        name: "Late Co",
      });
      await access.setCompany(accountId, {
        companyId: lateCompany.id,
        contactId: survivor.id,
      });

      const result = await confirmUndo(access, retired.id);

      expect(result.survivor).toMatchObject({
        company: { id: lateCompany.id },
        displayName: "Ada Lovelace",
        emails: ["ada@example.com", "late@example.com"],
      });
      expect(
        (await access.resolveContact(accountId, { contactId: survivor.id }))
          .feedbackIds,
      ).toEqual([lateFeedback]);
      expect(result.restored.company?.name).toBe("Acme");
    });

    async function seedAdoptedName() {
      const access = createDatabaseContacts(requireDatabase());
      const survivor = await access.createContact(accountId, {});
      const retired = await access.createContact(accountId, {
        displayName: "Grace",
      });
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      return { access, retired, survivor };
    }

    test("stops for a user decision when the adopted value was edited later", async () => {
      const { access, retired, survivor } = await seedAdoptedName();
      await access.updateContact(accountId, {
        contactId: survivor.id,
        displayName: "Grace Hopper",
      });

      const preview = await access.previewMergeUndo(accountId, {
        retiredId: retired.id,
      });
      expect(preview.conflicts).toEqual([
        {
          currentValue: "Grace Hopper",
          field: "Display name",
          previousValue: null,
        },
      ]);
      await expect(confirmUndo(access, retired.id)).rejects.toBeInstanceOf(
        ContactMergeUndoConflictError,
      );
      // Nothing was written: the copy is still a redirect.
      await expect(
        access.getContact(accountId, { contactId: retired.id }),
      ).rejects.toBeInstanceOf(ContactNotFoundError);

      const kept = await confirmUndo(access, retired.id, "Keep current value");
      expect(kept.survivor.displayName).toBe("Grace Hopper");
      expect(kept.restored.displayName).toBe("Grace");
    });

    test("restores the previous value when the founder chooses it", async () => {
      const { access, retired, survivor } = await seedAdoptedName();
      await access.updateContact(accountId, {
        contactId: survivor.id,
        displayName: "Grace Hopper",
      });

      const result = await confirmUndo(
        access,
        retired.id,
        "Restore previous value",
      );

      expect(result.survivor.displayName).toBeNull();
      expect(result.restored.displayName).toBe("Grace");
    });

    test("removes an unedited adopted value without asking", async () => {
      const { access, retired } = await seedAdoptedName();

      const result = await confirmUndo(access, retired.id);

      expect(result.survivor.displayName).toBeNull();
      expect(result.restored.displayName).toBe("Grace");
    });

    test("states redacted or permanently deleted content as unrestorable instead of a full undo", async () => {
      const { access, feedbackId, personaId, retired, survivor } =
        await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      const db = requireDatabase();
      await db.delete(feedback).where(eq(feedback.id, feedbackId));
      await db.delete(document).where(eq(document.id, personaId));

      const preview = await access.previewMergeUndo(accountId, {
        retiredId: retired.id,
      });
      expect(preview.unrestorable).toEqual([
        { count: 1, kind: "Feedback link" },
        { count: 1, kind: "Persona link" },
      ]);
      expect(preview.restoredFeedbackIds).toEqual([]);
      expect(preview.restoredPersonaDocuments).toEqual([]);
      expect(preview.restoredEmails).toEqual([
        "ada@example.com",
        "ada@work.example",
      ]);

      const result = await confirmUndo(access, retired.id);
      expect(result.unrestorable).toEqual(preview.unrestorable);
      expect(result.restored.personaDocuments).toEqual([]);
      expect(result.restored.emails).toHaveLength(2);
    });

    test("previews without writing and rejects a Contact that was never merged away", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      const before = await access.listContacts(accountId);

      await access.previewMergeUndo(accountId, { retiredId: retired.id });

      expect(await access.listContacts(accountId)).toEqual(before);
      await expect(
        access.previewMergeUndo(accountId, { retiredId: survivor.id }),
      ).rejects.toBeInstanceOf(ContactMergeNotFoundError);
      await expect(confirmUndo(access, survivor.id)).rejects.toBeInstanceOf(
        ContactMergeNotFoundError,
      );
    });

    test("undoes chained merges newest first and restores the older redirect", async () => {
      const access = createDatabaseContacts(requireDatabase());
      const first = await access.createContact(accountId, {
        email: "a@x.test",
      });
      const second = await access.createContact(accountId, {
        email: "b@x.test",
      });
      const third = await access.createContact(accountId, {
        email: "c@x.test",
      });
      await access.mergeContacts(accountId, {
        retiredId: first.id,
        survivorId: second.id,
      });
      await access.mergeContacts(accountId, {
        retiredId: second.id,
        survivorId: third.id,
      });

      await expect(confirmUndo(access, first.id)).rejects.toBeInstanceOf(
        ContactMergeUndoBlockedError,
      );

      await confirmUndo(access, second.id);
      expect(
        (await access.resolveContact(accountId, { contactId: first.id }))
          .contact.id,
      ).toBe(second.id);

      const result = await confirmUndo(access, first.id);
      expect(result.restored.emails).toEqual(["a@x.test"]);
      expect(result.survivor.emails).toEqual(["b@x.test"]);
    });

    test("returns the restored Contact when undo is confirmed twice", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      const preview = await access.previewMergeUndo(accountId, {
        retiredId: retired.id,
      });
      const input = {
        expectedSurvivorRevision: preview.survivor.revision,
        retiredId: retired.id,
      };
      const first = await access.undoMerge(accountId, input);

      const replay = await access.undoMerge(accountId, input);

      expect(replay.mergeId).toBe(first.mergeId);
      expect(replay.restored.id).toBe(retired.id);
      expect(
        await requireDatabase()
          .select()
          .from(workspaceContactAuditEvent)
          .where(eq(workspaceContactAuditEvent.workspaceId, workspaceId)),
      ).toHaveLength(2);
    });

    test("can merge the restored Contact again", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      await confirmUndo(access, retired.id);

      const again = await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });

      expect(again.survivor.emails).toContain("ada@work.example");
      expect((await confirmUndo(access, retired.id)).restored.id).toBe(
        retired.id,
      );
    });

    test("stays inside the Workspace", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });

      await expect(
        access.undoMerge(otherAccountId, {
          expectedSurvivorRevision: survivor.revision,
          retiredId: retired.id,
        }),
      ).rejects.toBeInstanceOf(ContactMergeNotFoundError);
    });

    test("keeps a value a later open merge still depends on when an earlier merge is undone", async () => {
      const access = createDatabaseContacts(requireDatabase());
      const survivor = await access.createContact(accountId, {
        email: "survivor@example.com",
      });
      const firstCopy = await access.createContact(accountId, {
        email: "shared@example.com",
      });
      const secondCopy = await access.createContact(accountId, {
        email: "shared@example.com",
      });
      const personaId = await insertDocument(projectId, "Persona", "Shared");
      const sharedFeedbackId = await insertFeedback(projectId, "Shared");
      await Promise.all(
        [firstCopy, secondCopy].flatMap((copy) => [
          access.linkPersona(accountId, {
            contactId: copy.id,
            documentId: personaId,
          }),
          access.linkFeedback(accountId, {
            contactId: copy.id,
            feedbackId: sharedFeedbackId,
          }),
        ]),
      );
      await access.mergeContacts(accountId, {
        retiredId: firstCopy.id,
        survivorId: survivor.id,
      });
      await access.mergeContacts(accountId, {
        retiredId: secondCopy.id,
        survivorId: survivor.id,
      });

      const firstUndo = await confirmUndo(access, firstCopy.id);

      expect(firstUndo.restored.emails).toEqual(["shared@example.com"]);
      expect(
        firstUndo.restored.personaDocuments.map((p) => p.documentId),
      ).toEqual([personaId]);
      const stillMerged = await access.resolveContact(accountId, {
        contactId: secondCopy.id,
      });
      expect(stillMerged.contact.id).toBe(survivor.id);
      expect(stillMerged.contact.emails.sort()).toEqual([
        "shared@example.com",
        "survivor@example.com",
      ]);
      expect(
        stillMerged.contact.personaDocuments.map((p) => p.documentId),
      ).toEqual([personaId]);
      expect(stillMerged.feedbackIds).toEqual([sharedFeedbackId]);

      const secondUndo = await confirmUndo(access, secondCopy.id);

      expect(secondUndo.restored.emails).toEqual(["shared@example.com"]);
      expect(secondUndo.survivor.emails).toEqual(["survivor@example.com"]);
      expect(secondUndo.survivor.personaDocuments).toEqual([]);
      expect(
        (await access.resolveContact(accountId, { contactId: survivor.id }))
          .feedbackIds,
      ).toEqual([]);
    });

    test("gives back the copy's Company and keeps the survivor's own Company", async () => {
      const access = createDatabaseContacts(requireDatabase());
      const globex = await access.createCompany(accountId, { name: "Globex" });
      const acme = await access.createCompany(accountId, { name: "Acme" });
      const survivor = await access.createContact(accountId, {
        companyId: globex.id,
        email: "ada@example.com",
      });
      const retired = await access.createContact(accountId, {
        companyId: acme.id,
        email: "ada@work.example",
      });
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });

      const result = await confirmUndo(access, retired.id);

      expect(result.restored.company).toMatchObject({ id: acme.id });
      expect(result.survivor.company).toMatchObject({ id: globex.id });
    });

    test("rejects an undo confirmed against a survivor revision the founder did not review", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      const preview = await access.previewMergeUndo(accountId, {
        retiredId: retired.id,
      });
      await access.updateContact(accountId, {
        contactId: survivor.id,
        displayName: "Ada Lovelace",
      });

      await expect(
        access.undoMerge(accountId, {
          expectedSurvivorRevision: preview.survivor.revision,
          retiredId: retired.id,
        }),
      ).rejects.toBeInstanceOf(ContactRevisionConflictError);
      await expect(
        access.getContact(accountId, { contactId: retired.id }),
      ).rejects.toBeInstanceOf(ContactNotFoundError);
    });

    test("rejects a replayed undo whose answer differs from the confirmed one", async () => {
      const { access, retired, survivor } = await seedAdoptedName();
      await access.updateContact(accountId, {
        contactId: survivor.id,
        displayName: "Grace Hopper",
      });
      const preview = await access.previewMergeUndo(accountId, {
        retiredId: retired.id,
      });
      const confirmed = {
        expectedSurvivorRevision: preview.survivor.revision,
        resolutions: { displayName: "Keep current value" as const },
        retiredId: retired.id,
      };
      await access.undoMerge(accountId, confirmed);

      await expect(
        access.undoMerge(accountId, {
          ...confirmed,
          resolutions: { displayName: "Restore previous value" },
        }),
      ).rejects.toBeInstanceOf(ContactMergeUndoPayloadChangedError);
      expect((await access.undoMerge(accountId, confirmed)).restored.id).toBe(
        retired.id,
      );
    });

    test("replays a double confirmation sent at the same time with one undo", async () => {
      const { access, retired, survivor } = await seedDuplicates();
      await access.mergeContacts(accountId, {
        retiredId: retired.id,
        survivorId: survivor.id,
      });
      const preview = await access.previewMergeUndo(accountId, {
        retiredId: retired.id,
      });
      const input = {
        expectedSurvivorRevision: preview.survivor.revision,
        retiredId: retired.id,
      };

      const [first, second] = await Promise.all([
        access.undoMerge(accountId, input),
        access.undoMerge(accountId, input),
      ]);

      expect(second.mergeId).toBe(first.mergeId);
      expect(second.restored.id).toBe(retired.id);
      const undoEvents = (
        await requireDatabase()
          .select()
          .from(workspaceContactAuditEvent)
          .where(eq(workspaceContactAuditEvent.workspaceId, workspaceId))
      ).filter((event) => event.eventType === "contact.merge_undone");
      expect(undoEvents).toHaveLength(1);
    });
  });
});
