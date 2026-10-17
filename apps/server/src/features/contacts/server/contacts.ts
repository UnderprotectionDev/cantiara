import {
  type Contact,
  type ContactStore,
  type ContactsAccess,
  contactIdentityInputSchema,
  contactPersonaInputSchema,
  createCompanyInputSchema,
  createContactInputSchema,
  type DuplicateCandidate,
  setContactCompanyInputSchema,
  updateContactInputSchema,
} from "@cantiara/api/contacts";

export class ContactWorkspaceNotFoundError extends Error {
  readonly code = "CONTACT_WORKSPACE_NOT_FOUND" as const;

  constructor() {
    super("Workspace was not found for this Account.");
    this.name = "ContactWorkspaceNotFoundError";
  }
}

export class ContactNotFoundError extends Error {
  readonly code = "CONTACT_NOT_FOUND" as const;

  constructor(contactId: string) {
    super(`Contact ${contactId} was not found.`);
    this.name = "ContactNotFoundError";
  }
}

export class CompanyNotFoundError extends Error {
  readonly code = "COMPANY_NOT_FOUND" as const;

  constructor(companyId: string) {
    super(`Company ${companyId} was not found.`);
    this.name = "CompanyNotFoundError";
  }
}

export class ContactPersonaDocumentNotFoundError extends Error {
  readonly code = "CONTACT_PERSONA_DOCUMENT_NOT_FOUND" as const;

  constructor(documentId: string) {
    super(`Persona Document ${documentId} was not found.`);
    this.name = "ContactPersonaDocumentNotFoundError";
  }
}

export class ContactRevisionConflictError extends Error {
  readonly code = "CONTACT_REVISION_CONFLICT" as const;

  constructor(contactId: string) {
    super(`Contact ${contactId} changed since it was loaded.`);
    this.name = "ContactRevisionConflictError";
  }
}

const whitespacePattern = /\s+/u;
const combiningMarkPattern = /\p{M}/gu;

function normalizeName(name: string | null) {
  return (
    name
      ?.normalize("NFKD")
      .replaceAll(combiningMarkPattern, "")
      .toLocaleLowerCase("en-US")
      .split(whitespacePattern)
      .filter(Boolean) ?? []
  );
}

function pairKey(first: string, second: string) {
  return first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`;
}

function strongCandidates(live: readonly Contact[]) {
  const byEmail = new Map<string, string[]>();
  for (const contact of live) {
    for (const email of new Set(contact.emails)) {
      byEmail.set(email, [...(byEmail.get(email) ?? []), contact.id]);
    }
  }
  const candidates: DuplicateCandidate[] = [];
  const pairs = new Set<string>();
  for (const contactIds of byEmail.values()) {
    if (contactIds.length < 2) {
      continue;
    }
    candidates.push({
      contactIds,
      reasons: ["Same email"],
      strength: "strong",
    });
    for (const [index, first] of contactIds.entries()) {
      for (const second of contactIds.slice(index + 1)) {
        pairs.add(pairKey(first, second));
      }
    }
  }
  return { candidates, pairs };
}

function weakReason(
  first: Contact,
  second: Contact,
): DuplicateCandidate["reasons"][number] | null {
  const firstName = normalizeName(first.displayName);
  const secondName = normalizeName(second.displayName);
  if (firstName.length === 0 || secondName.length === 0) {
    return null;
  }
  if (firstName.join(" ") === secondName.join(" ")) {
    return "Similar name";
  }
  const sameCompany =
    first.company !== null && first.company.id === second.company?.id;
  if (sameCompany && firstName.some((token) => secondName.includes(token))) {
    return "Same Company and name";
  }
  return null;
}

/**
 * Read-only: groups live Contacts that share a normalized email (strong) and
 * pairs the remaining ones with a similar name or a shared Company and name
 * token (weak). It never writes, so no candidate can merge itself.
 */
export function findDuplicateCandidates(
  contacts: readonly Contact[],
): DuplicateCandidate[] {
  const live = contacts.filter((contact) => contact.archivedAt === null);
  const strong = strongCandidates(live);
  const candidates = [...strong.candidates];
  for (const [index, first] of live.entries()) {
    for (const second of live.slice(index + 1)) {
      const reason = strong.pairs.has(pairKey(first.id, second.id))
        ? null
        : weakReason(first, second);
      if (reason) {
        candidates.push({
          contactIds: [first.id, second.id],
          reasons: [reason],
          strength: "weak",
        });
      }
    }
  }
  return candidates;
}

export function createContacts({
  store,
}: {
  store: ContactStore;
}): ContactsAccess {
  async function workspaceIdFor(accountId: string) {
    const workspaceId = await store.findWorkspaceId(accountId);
    if (!workspaceId) {
      throw new ContactWorkspaceNotFoundError();
    }
    return workspaceId;
  }

  return {
    async createCompany(accountId, input) {
      const parsed = createCompanyInputSchema.parse(input);
      return store.createCompany(await workspaceIdFor(accountId), parsed);
    },

    async createContact(accountId, input) {
      const parsed = createContactInputSchema.parse(input);
      return store.createContact(await workspaceIdFor(accountId), parsed);
    },

    async getContact(accountId, input) {
      const parsed = contactIdentityInputSchema.parse(input);
      return store.getContact(
        await workspaceIdFor(accountId),
        parsed.contactId,
      );
    },

    async listDuplicateCandidates(accountId) {
      return findDuplicateCandidates(
        await store.listContacts(await workspaceIdFor(accountId)),
      );
    },

    async linkPersona(accountId, input) {
      const parsed = contactPersonaInputSchema.parse(input);
      return store.linkPersona(await workspaceIdFor(accountId), parsed);
    },

    async listCompanies(accountId) {
      return store.listCompanies(await workspaceIdFor(accountId));
    },

    async listContacts(accountId) {
      return store.listContacts(await workspaceIdFor(accountId));
    },

    async setCompany(accountId, input) {
      const parsed = setContactCompanyInputSchema.parse(input);
      return store.setCompany(await workspaceIdFor(accountId), parsed);
    },

    async unlinkPersona(accountId, input) {
      const parsed = contactPersonaInputSchema.parse(input);
      return store.unlinkPersona(await workspaceIdFor(accountId), parsed);
    },

    async updateContact(accountId, input) {
      const parsed = updateContactInputSchema.parse(input);
      return store.updateContact(await workspaceIdFor(accountId), parsed);
    },
  };
}
