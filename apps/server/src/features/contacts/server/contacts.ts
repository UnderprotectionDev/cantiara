import {
  type ContactStore,
  type ContactsAccess,
  contactIdentityInputSchema,
  contactPersonaInputSchema,
  createCompanyInputSchema,
  createContactInputSchema,
  setContactCompanyInputSchema,
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
  };
}
