import type {
  Company,
  Contact,
  ContactStore,
  ParsedCreateContactInput,
} from "@cantiara/api/contacts";
import { describe, expect, test } from "vitest";

import {
  CompanyNotFoundError,
  ContactNotFoundError,
  ContactRevisionConflictError,
  ContactWorkspaceNotFoundError,
  createContacts,
} from "./contacts";

const mergeKeyPattern = /merge/i;
const timestamp = "2026-09-20T09:00:00.000Z";

function createMemoryStore() {
  const contacts = new Map<string, Contact>();
  const companies = new Map<string, Company>();
  const feedbackByContact = new Map<string, string[]>();
  let sequence = 0;

  function contactFor(contactId: string) {
    const contact = contacts.get(contactId);
    if (!contact) {
      throw new ContactNotFoundError(contactId);
    }
    return contact;
  }

  function reference(companyId: string) {
    const company = companies.get(companyId);
    if (!company) {
      throw new CompanyNotFoundError(companyId);
    }
    return { archivedAt: null, id: company.id, name: company.name };
  }

  const store: ContactStore = {
    createCompany: async (_workspaceId, input) => {
      await Promise.resolve();
      sequence += 1;
      const company: Company = {
        archivedAt: null,
        contactCount: 0,
        createdAt: timestamp,
        id: `company-${sequence}`,
        name: input.name,
        revision: 0,
      };
      companies.set(company.id, company);
      return company;
    },
    createContact: async (_workspaceId, input: ParsedCreateContactInput) => {
      await Promise.resolve();
      sequence += 1;
      const company = input.companyId ? reference(input.companyId) : null;
      const contact: Contact = {
        archivedAt: null,
        company,
        companyHistory: company
          ? [{ company, endedAt: null, startedAt: timestamp }]
          : [],
        createdAt: timestamp,
        displayName: input.displayName ?? null,
        emails: input.email ? [input.email] : [],
        id: `contact-${sequence}`,
        personaDocuments: [],
        revision: 0,
      };
      contacts.set(contact.id, contact);
      return contact;
    },
    findWorkspaceId: async (accountId) => {
      await Promise.resolve();
      return accountId === "account-1" ? "workspace-1" : null;
    },
    getContact: async (_workspaceId, contactId) => {
      await Promise.resolve();
      return contactFor(contactId);
    },
    linkFeedback: () => Promise.reject(new Error("Not part of this test.")),
    linkPersona: () => Promise.reject(new Error("Not part of this test.")),
    mergeContacts: () => Promise.reject(new Error("Not part of this test.")),
    readMergeInputs: async (_workspaceId, input) => {
      await Promise.resolve();
      return {
        retired: contactFor(input.retiredId),
        retiredFeedbackIds: feedbackByContact.get(input.retiredId) ?? [],
        survivor: contactFor(input.survivorId),
        survivorFeedbackIds: feedbackByContact.get(input.survivorId) ?? [],
      };
    },
    resolveContact: () => Promise.reject(new Error("Not part of this test.")),
    listCompanies: async () => {
      await Promise.resolve();
      return [...companies.values()];
    },
    updateContact: async (_workspaceId, input) => {
      await Promise.resolve();
      const current = contactFor(input.contactId);
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== current.revision
      ) {
        throw new ContactRevisionConflictError(current.id);
      }
      const emails =
        input.email && !current.emails.includes(input.email)
          ? [...current.emails, input.email]
          : current.emails;
      const displayName =
        input.displayName === undefined
          ? current.displayName
          : input.displayName;
      const changed =
        displayName !== current.displayName || emails !== current.emails;
      const updated: Contact = {
        ...current,
        displayName,
        emails,
        revision: changed ? current.revision + 1 : current.revision,
      };
      contacts.set(updated.id, updated);
      return updated;
    },
    listContacts: async () => {
      await Promise.resolve();
      return [...contacts.values()];
    },
    setCompany: async (_workspaceId, input) => {
      await Promise.resolve();
      const current = contactFor(input.contactId);
      const next = input.companyId ? reference(input.companyId) : null;
      const history = current.companyHistory.map((entry) =>
        entry.endedAt === null ? { ...entry, endedAt: timestamp } : entry,
      );
      const updated: Contact = {
        ...current,
        company: next,
        companyHistory: next
          ? [...history, { company: next, endedAt: null, startedAt: timestamp }]
          : history,
        revision: current.revision + 1,
      };
      contacts.set(updated.id, updated);
      return updated;
    },
    unlinkPersona: () => Promise.reject(new Error("Not part of this test.")),
  };

  return Object.assign(store, { feedbackByContact });
}

describe("Contact and Company", () => {
  test("creates a Contact without a display name, email or Company", async () => {
    const access = createContacts({ store: createMemoryStore() });

    const contact = await access.createContact("account-1", {});

    expect(contact).toMatchObject({
      company: null,
      companyHistory: [],
      displayName: null,
      emails: [],
      personaDocuments: [],
    });
    expect(contact.id).not.toBe("");
  });

  test("keeps identity separate from email by normalizing it as an alias", async () => {
    const access = createContacts({ store: createMemoryStore() });

    const first = await access.createContact("account-1", {
      displayName: "  Ada Lovelace ",
      email: "  Ada@Example.COM ",
    });
    const copy = await access.createContact("account-1", {
      email: "ada@example.com",
    });

    expect(first.displayName).toBe("Ada Lovelace");
    expect(first.emails).toEqual(["ada@example.com"]);
    expect(copy.id).not.toBe(first.id);
    expect(copy.emails).toEqual(first.emails);
  });

  test("rejects an invalid email and a blank display name", async () => {
    const access = createContacts({ store: createMemoryStore() });

    await expect(
      access.createContact("account-1", { email: "not-an-email" }),
    ).rejects.toThrow("Enter a valid email address.");
    await expect(
      access.createContact("account-1", { displayName: "   " }),
    ).rejects.toThrow("Display name is required when provided.");
  });

  test("makes Company optional and keeps one current Belongs to Company link with history", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const acme = await access.createCompany("account-1", { name: "Acme" });
    const globex = await access.createCompany("account-1", { name: "Globex" });
    const contact = await access.createContact("account-1", {
      companyId: acme.id,
      displayName: "Grace",
    });

    const moved = await access.setCompany("account-1", {
      companyId: globex.id,
      contactId: contact.id,
    });
    const cleared = await access.setCompany("account-1", {
      companyId: null,
      contactId: contact.id,
    });

    expect(contact.company?.name).toBe("Acme");
    expect(moved.company?.name).toBe("Globex");
    expect(
      moved.companyHistory.filter((entry) => entry.endedAt === null),
    ).toHaveLength(1);
    expect(cleared.company).toBeNull();
    expect(cleared.companyHistory.map((entry) => entry.company.name)).toEqual([
      "Acme",
      "Globex",
    ]);
    expect(
      cleared.companyHistory.every((entry) => entry.endedAt !== null),
    ).toBe(true);
  });

  test("rejects an unknown Company", async () => {
    const access = createContacts({ store: createMemoryStore() });

    await expect(
      access.createContact("account-1", { companyId: "missing" }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
  });

  test("rejects CRM fields on Contact and Company input", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const crmFields = [
      "plan",
      "subscription",
      "arr",
      "mrr",
      "revenue",
      "contract",
      "salesStage",
      "geoSegment",
      "commercialScore",
    ];

    await Promise.all(
      crmFields.flatMap((field) => [
        expect(
          access.createContact("account-1", { [field]: "x" } as never),
        ).rejects.toThrow(),
        expect(
          access.createCompany("account-1", {
            name: "Acme",
            [field]: "x",
          } as never),
        ).rejects.toThrow(),
      ]),
    );
  });

  test("exposes no CRM fields on the Contact profile", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const company = await access.createCompany("account-1", { name: "Acme" });
    const contact = await access.createContact("account-1", {
      companyId: company.id,
    });

    expect(Object.keys(contact).sort()).toEqual([
      "archivedAt",
      "company",
      "companyHistory",
      "createdAt",
      "displayName",
      "emails",
      "id",
      "personaDocuments",
      "revision",
    ]);
    expect(Object.keys(company).sort()).toEqual([
      "archivedAt",
      "contactCount",
      "createdAt",
      "id",
      "name",
      "revision",
    ]);
  });

  test("adds a display name and email alias later without changing identity", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const contact = await access.createContact("account-1", {});

    const updated = await access.updateContact("account-1", {
      contactId: contact.id,
      displayName: "  Grace Hopper ",
      email: "Grace@Example.COM",
      expectedRevision: contact.revision,
    });

    expect(updated).toMatchObject({
      displayName: "Grace Hopper",
      emails: ["grace@example.com"],
      id: contact.id,
      revision: contact.revision + 1,
    });
  });

  test("clears the display name with null and rejects a stale revision", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const contact = await access.createContact("account-1", {
      displayName: "Grace",
    });

    const cleared = await access.updateContact("account-1", {
      contactId: contact.id,
      displayName: null,
    });

    expect(cleared.displayName).toBeNull();
    await expect(
      access.updateContact("account-1", {
        contactId: contact.id,
        displayName: "Late edit",
        expectedRevision: contact.revision,
      }),
    ).rejects.toBeInstanceOf(ContactRevisionConflictError);
  });

  test("never assigns a Persona on creation", async () => {
    const access = createContacts({ store: createMemoryStore() });

    const contact = await access.createContact("account-1", {
      displayName: "Persona candidate",
      email: "persona@example.com",
    });

    expect(contact.personaDocuments).toEqual([]);
  });

  test("lists the same normalized email as a strong candidate without merging", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const first = await access.createContact("account-1", {
      displayName: "Ada",
      email: "Ada@Example.com",
    });
    const copy = await access.createContact("account-1", {
      email: " ada@example.COM ",
    });
    const other = await access.createContact("account-1", {
      email: "grace@example.com",
    });
    const before = await access.listContacts("account-1");

    const candidates = await access.listDuplicateCandidates("account-1");

    expect(candidates).toEqual([
      {
        contactIds: [first.id, copy.id],
        reasons: ["Same email"],
        strength: "strong",
      },
    ]);
    expect(candidates[0]?.contactIds).not.toContain(other.id);
    expect(await access.listContacts("account-1")).toEqual(before);
  });

  test("lists a similar name or Company only as a weak suggestion", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const acme = await access.createCompany("account-1", { name: "Acme" });
    const first = await access.createContact("account-1", {
      displayName: "Ada Lovelace",
    });
    const sameName = await access.createContact("account-1", {
      displayName: "  ada   LOVELACE ",
    });
    const second = await access.createContact("account-1", {
      companyId: acme.id,
      displayName: "Grace Hopper",
    });
    const sameCompany = await access.createContact("account-1", {
      companyId: acme.id,
      displayName: "G. Hopper",
    });
    const third = await access.createContact("account-1", {
      companyId: acme.id,
      displayName: "Linus Torvalds",
    });
    await access.createContact("account-1", { displayName: "Hopper" });

    const candidates = await access.listDuplicateCandidates("account-1");

    expect(candidates.every((candidate) => candidate.strength === "weak")).toBe(
      true,
    );
    expect(candidates).toEqual([
      {
        contactIds: [first.id, sameName.id],
        reasons: ["Similar name"],
        strength: "weak",
      },
      {
        contactIds: [second.id, sameCompany.id],
        reasons: ["Same Company"],
        strength: "weak",
      },
      {
        contactIds: [second.id, third.id],
        reasons: ["Same Company"],
        strength: "weak",
      },
      {
        contactIds: [sameCompany.id, third.id],
        reasons: ["Same Company"],
        strength: "weak",
      },
    ]);
  });

  test("lists Contacts sharing several emails as one strong candidate", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const first = await access.createContact("account-1", {
      email: "a@example.com",
    });
    const second = await access.createContact("account-1", {
      email: "a@example.com",
    });
    await access.updateContact("account-1", {
      contactId: first.id,
      email: "b@example.com",
    });
    await access.updateContact("account-1", {
      contactId: second.id,
      email: "b@example.com",
    });

    const candidates = await access.listDuplicateCandidates("account-1");

    expect(candidates).toHaveLength(1);
  });

  test("does not downgrade a strong candidate into an extra weak one", async () => {
    const access = createContacts({ store: createMemoryStore() });
    await access.createContact("account-1", {
      displayName: "Ada",
      email: "ada@example.com",
    });
    await access.createContact("account-1", {
      displayName: "Ada",
      email: "ada@example.com",
    });

    const candidates = await access.listDuplicateCandidates("account-1");

    expect(candidates.map((candidate) => candidate.strength)).toEqual([
      "strong",
    ]);
  });

  test("merges only Contacts, never Companies", () => {
    const access = createContacts({ store: createMemoryStore() });

    expect(
      Object.keys(access)
        .filter((key) => mergeKeyPattern.test(key))
        .sort(),
    ).toEqual(["mergeContacts", "previewMerge"]);
  });

  test("previews the survivor, conflicts, aliases, Feedback and Persona links without writing", async () => {
    const store = createMemoryStore();
    const access = createContacts({ store });
    const acme = await access.createCompany("account-1", { name: "Acme" });
    const globex = await access.createCompany("account-1", { name: "Globex" });
    const survivor = await access.createContact("account-1", {
      companyId: acme.id,
      displayName: "Ada",
      email: "ada@example.com",
    });
    const retired = await access.createContact("account-1", {
      companyId: globex.id,
      displayName: "Ada L.",
      email: "ada@work.example",
    });
    store.feedbackByContact.set(survivor.id, ["feedback-1"]);
    store.feedbackByContact.set(retired.id, ["feedback-1", "feedback-2"]);
    const before = await access.listContacts("account-1");

    const preview = await access.previewMerge("account-1", {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(preview.survivor.id).toBe(survivor.id);
    expect(preview.retired.id).toBe(retired.id);
    expect(preview.fieldConflicts).toEqual([
      {
        field: "Display name",
        retiredValue: "Ada L.",
        survivorValue: "Ada",
      },
      { field: "Company", retiredValue: "Globex", survivorValue: "Acme" },
    ]);
    expect(preview.addedEmails).toEqual(["ada@work.example"]);
    expect(preview.feedbackIds).toEqual(["feedback-2"]);
    expect(preview.companyOutcome).toBe("Keep survivor");
    expect(await access.listContacts("account-1")).toEqual(before);
  });

  test("adopts the copy's Company only when the survivor has none", async () => {
    const store = createMemoryStore();
    const access = createContacts({ store });
    const acme = await access.createCompany("account-1", { name: "Acme" });
    const survivor = await access.createContact("account-1", {});
    const retired = await access.createContact("account-1", {
      companyId: acme.id,
    });

    const preview = await access.previewMerge("account-1", {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(preview.companyOutcome).toBe("Adopt retired");
    expect(preview.fieldConflicts).toEqual([]);
  });

  test("rejects merging a Contact into itself", async () => {
    const access = createContacts({ store: createMemoryStore() });
    const contact = await access.createContact("account-1", {});

    await expect(
      access.previewMerge("account-1", {
        retiredId: contact.id,
        survivorId: contact.id,
      }),
    ).rejects.toThrow("Choose two different Contacts to merge.");
    await expect(
      access.mergeContacts("account-1", {
        retiredId: contact.id,
        survivorId: contact.id,
      }),
    ).rejects.toThrow("Choose two different Contacts to merge.");
  });

  test("the preview carries no Kanıt Rolü, comment, evidence or priority values", async () => {
    const store = createMemoryStore();
    const access = createContacts({ store });
    const survivor = await access.createContact("account-1", {});
    const retired = await access.createContact("account-1", {});

    const preview = await access.previewMerge("account-1", {
      retiredId: retired.id,
      survivorId: survivor.id,
    });

    expect(Object.keys(preview).sort()).toEqual([
      "addedEmails",
      "companyOutcome",
      "feedbackIds",
      "fieldConflicts",
      "personaDocuments",
      "retired",
      "survivor",
    ]);
  });

  test("fails closed without a Workspace", async () => {
    const access = createContacts({ store: createMemoryStore() });

    await expect(access.listContacts("account-2")).rejects.toBeInstanceOf(
      ContactWorkspaceNotFoundError,
    );
  });
});
