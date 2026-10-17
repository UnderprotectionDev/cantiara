import {
  type Contact,
  type ContactMergeInputs,
  type ContactStore,
  type ContactsAccess,
  contactIdentityInputSchema,
  contactPersonaInputSchema,
  createCompanyInputSchema,
  createContactInputSchema,
  type DuplicateCandidate,
  linkContactFeedbackInputSchema,
  type MergeFieldConflict,
  type MergePreview,
  mergeContactsInputSchema,
  mergePreviewInputSchema,
  mergeUndoPreviewInputSchema,
  setContactCompanyInputSchema,
  undoMergeInputSchema,
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

export class ContactFeedbackNotFoundError extends Error {
  readonly code = "CONTACT_FEEDBACK_NOT_FOUND" as const;

  constructor(feedbackId: string) {
    super(`Feedback ${feedbackId} was not found.`);
    this.name = "ContactFeedbackNotFoundError";
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

export class ContactMergeNotFoundError extends Error {
  readonly code = "CONTACT_MERGE_NOT_FOUND" as const;

  constructor(retiredId: string) {
    super(`No merge to undo was found for ${retiredId}.`);
    this.name = "ContactMergeNotFoundError";
  }
}

export class ContactMergeUndoBlockedError extends Error {
  readonly code = "CONTACT_MERGE_UNDO_BLOCKED" as const;

  constructor(survivingContactId: string) {
    super(
      `Surviving Contact ${survivingContactId} was itself merged away; undo that merge first.`,
    );
    this.name = "ContactMergeUndoBlockedError";
  }
}

export class ContactMergeUndoPayloadChangedError extends Error {
  readonly code = "CONTACT_MERGE_UNDO_PAYLOAD_CHANGED" as const;

  constructor(retiredId: string) {
    super(
      `Undo for ${retiredId} was already confirmed with a different answer.`,
    );
    this.name = "ContactMergeUndoPayloadChangedError";
  }
}

export class ContactMergeUndoConflictError extends Error {
  readonly code = "CONTACT_MERGE_UNDO_CONFLICT" as const;

  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Undo needs a decision for: ${fields.join(", ")}.`);
    this.name = "ContactMergeUndoConflictError";
    this.fields = fields;
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
  const seenGroups = new Set<string>();
  for (const contactIds of byEmail.values()) {
    const groupKey = [...contactIds].sort().join("\u0000");
    if (contactIds.length < 2 || seenGroups.has(groupKey)) {
      continue;
    }
    seenGroups.add(groupKey);
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
  const firstName = normalizeName(first.displayName).join(" ");
  const secondName = normalizeName(second.displayName).join(" ");
  if (firstName !== "" && firstName === secondName) {
    return "Similar name";
  }
  if (first.company !== null && first.company.id === second.company?.id) {
    return "Same Company";
  }
  return null;
}

/**
 * Read-only: groups live Contacts that share a normalized email (strong) and
 * pairs the remaining ones with a similar name or a shared current Company
 * (weak). It never writes, so no candidate can merge itself.
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

function describeContactCompany(contact: Contact) {
  return contact.company?.name ?? "";
}

/**
 * Read-only: what `mergeContacts` will do with the survivor and the retired
 * copy. The survivor's own values win; the retired copy only fills what the
 * survivor leaves empty and adds its aliases, Feedback and Persona links.
 */
export function buildMergePreview({
  retired,
  retiredFeedbackIds,
  survivor,
  survivorFeedbackIds,
}: ContactMergeInputs): MergePreview {
  const fieldConflicts: MergeFieldConflict[] = [];
  if (
    survivor.displayName !== null &&
    retired.displayName !== null &&
    survivor.displayName !== retired.displayName
  ) {
    fieldConflicts.push({
      field: "Display name",
      retiredValue: retired.displayName,
      survivorValue: survivor.displayName,
    });
  }
  if (
    survivor.company !== null &&
    retired.company !== null &&
    survivor.company.id !== retired.company.id
  ) {
    fieldConflicts.push({
      field: "Company",
      retiredValue: describeContactCompany(retired),
      survivorValue: describeContactCompany(survivor),
    });
  }
  let companyOutcome: MergePreview["companyOutcome"] = "None";
  if (survivor.company) {
    companyOutcome = "Keep survivor";
  } else if (retired.company) {
    companyOutcome = "Adopt retired";
  }
  const survivorPersonas = new Set(
    survivor.personaDocuments.map((persona) => persona.documentId),
  );
  const survivorFeedback = new Set(survivorFeedbackIds);
  return {
    adoptedDisplayName:
      survivor.displayName === null ? retired.displayName : null,
    addedEmails: retired.emails.filter(
      (email) => !survivor.emails.includes(email),
    ),
    companyOutcome,
    feedbackIds: retiredFeedbackIds.filter((id) => !survivorFeedback.has(id)),
    fieldConflicts,
    personaDocuments: retired.personaDocuments.filter(
      (persona) => !survivorPersonas.has(persona.documentId),
    ),
    retired,
    survivor,
  };
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

    async linkFeedback(accountId, input) {
      const parsed = linkContactFeedbackInputSchema.parse(input);
      return store.linkFeedback(await workspaceIdFor(accountId), parsed);
    },

    async mergeContacts(accountId, input) {
      const parsed = mergeContactsInputSchema.parse(input);
      return store.mergeContacts(
        await workspaceIdFor(accountId),
        parsed,
        accountId,
      );
    },

    async previewMerge(accountId, input) {
      const parsed = mergePreviewInputSchema.parse(input);
      return buildMergePreview(
        await store.readMergeInputs(await workspaceIdFor(accountId), parsed),
      );
    },

    async previewMergeUndo(accountId, input) {
      const parsed = mergeUndoPreviewInputSchema.parse(input);
      return store.previewMergeUndo(await workspaceIdFor(accountId), parsed);
    },

    async resolveContact(accountId, input) {
      const parsed = contactIdentityInputSchema.parse(input);
      return store.resolveContact(
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

    async undoMerge(accountId, input) {
      const parsed = undoMergeInputSchema.parse(input);
      return store.undoMerge(
        await workspaceIdFor(accountId),
        parsed,
        accountId,
      );
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
