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
  ContactWorkspaceNotFoundError,
  createContacts,
} from "./contacts";

const timestamp = "2026-09-20T09:00:00.000Z";

function createMemoryStore() {
  const contacts = new Map<string, Contact>();
  const companies = new Map<string, Company>();
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
    linkPersona: () => Promise.reject(new Error("Not part of this test.")),
    listCompanies: async () => {
      await Promise.resolve();
      return [...companies.values()];
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

  return store;
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

  test("never assigns a Persona on creation", async () => {
    const access = createContacts({ store: createMemoryStore() });

    const contact = await access.createContact("account-1", {
      displayName: "Persona candidate",
      email: "persona@example.com",
    });

    expect(contact.personaDocuments).toEqual([]);
  });

  test("fails closed without a Workspace", async () => {
    const access = createContacts({ store: createMemoryStore() });

    await expect(access.listContacts("account-2")).rejects.toBeInstanceOf(
      ContactWorkspaceNotFoundError,
    );
  });
});
