// biome-ignore-all lint/performance/noJsxPropsBind: Contact controls act on the selected Contact and Company.

import {
  type Company,
  type Contact,
  createCompanyInputSchema,
  createContactInputSchema,
  type DuplicateCandidate,
  updateContactInputSchema,
} from "@cantiara/api/contacts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

const NO_COMPANY = "";

function contactLabel(contact: Pick<Contact, "displayName" | "emails">) {
  return contact.displayName ?? contact.emails[0] ?? "Unnamed Contact";
}

export default function ContactsView() {
  const queryClient = useQueryClient();
  const contacts = useQuery(orpc.contacts.queryOptions());
  const companies = useQuery(orpc.companies.queryOptions());
  const candidates = useQuery(orpc.contactDuplicateCandidates.queryOptions());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected =
    contacts.data?.find((contact) => contact.id === selectedId) ??
    contacts.data?.[0];

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.contacts.queryOptions().queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.companies.queryOptions().queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.contactDuplicateCandidates.queryOptions().queryKey,
      }),
    ]);
  const createContact = useMutation({
    mutationFn: (input: Parameters<typeof client.createContact>[0]) =>
      runOnlineOnlyWrite(() => client.createContact(input)),
    onSuccess: async (contact) => {
      setSelectedId(contact.id);
      await refresh();
    },
  });
  const createCompany = useMutation({
    mutationFn: (input: Parameters<typeof client.createCompany>[0]) =>
      runOnlineOnlyWrite(() => client.createCompany(input)),
    onSuccess: refresh,
  });
  const setCompany = useMutation({
    mutationFn: (input: Parameters<typeof client.setContactCompany>[0]) =>
      runOnlineOnlyWrite(() => client.setContactCompany(input)),
    onSuccess: refresh,
  });
  const updateContact = useMutation({
    mutationFn: (input: Parameters<typeof client.updateContact>[0]) =>
      runOnlineOnlyWrite(() => client.updateContact(input)),
    onSuccess: refresh,
  });

  async function submitContactUpdate(
    contact: Contact,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const parsed = updateContactInputSchema.safeParse({
      contactId: contact.id,
      displayName: displayName || null,
      ...(email ? { email } : {}),
      expectedRevision: contact.revision,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Contact is invalid.");
      return;
    }
    setError(null);
    try {
      await updateContact.mutateAsync(parsed.data);
    } catch {
      setError("Contact could not be saved.");
    }
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const displayName = String(data.get("displayName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const companyId = String(data.get("companyId") ?? NO_COMPANY);
    const parsed = createContactInputSchema.safeParse({
      ...(companyId ? { companyId } : {}),
      ...(displayName ? { displayName } : {}),
      ...(email ? { email } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Contact is invalid.");
      return;
    }
    setError(null);
    try {
      await createContact.mutateAsync(parsed.data);
      form.reset();
    } catch {
      setError("Contact could not be created.");
    }
  }

  async function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = createCompanyInputSchema.safeParse({
      name: String(new FormData(form).get("name") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Company is invalid.");
      return;
    }
    setError(null);
    try {
      await createCompany.mutateAsync(parsed.data);
      form.reset();
    } catch {
      setError("Company could not be created.");
    }
  }

  async function changeCompany(contact: Contact, companyId: string) {
    setError(null);
    try {
      await setCompany.mutateAsync({
        companyId: companyId === NO_COMPANY ? null : companyId,
        contactId: contact.id,
        expectedRevision: contact.revision,
      });
    } catch {
      setError("Belongs to Company could not be updated.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-9 sm:px-8">
      <header className="border-b pb-6">
        <h1 className="font-semibold text-3xl">Contact</h1>
        <p className="mt-2 text-muted-foreground">
          People who give Feedback, with an optional Company.
        </p>
      </header>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label="Create Contact" className="space-y-4">
          <h2 className="font-semibold text-xl">Create Contact</h2>
          <form className="flex flex-col gap-4" onSubmit={submitContact}>
            <label className="flex flex-col gap-1 text-sm">
              Display name
              <input
                className="rounded-md border bg-background px-3 py-2"
                maxLength={255}
                name="displayName"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                className="rounded-md border bg-background px-3 py-2"
                name="email"
                type="email"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Company
              <select
                className="rounded-md border bg-background px-3 py-2"
                defaultValue={NO_COMPANY}
                name="companyId"
              >
                <option value={NO_COMPANY}>None</option>
                {companies.data?.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
              type="submit"
            >
              Create Contact
            </button>
          </form>
        </section>
        <section aria-label="Create Company" className="space-y-4">
          <h2 className="font-semibold text-xl">Create Company</h2>
          <form className="flex flex-col gap-4" onSubmit={submitCompany}>
            <label className="flex flex-col gap-1 text-sm">
              Company name
              <input
                className="rounded-md border bg-background px-3 py-2"
                maxLength={255}
                name="name"
              />
            </label>
            <button
              className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
              type="submit"
            >
              Create Company
            </button>
          </form>
        </section>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label="Contacts" className="space-y-3">
          <h2 className="font-semibold text-xl">Contacts</h2>
          {contacts.data?.length === 0 ? <p>No Contacts yet.</p> : null}
          <ul className="space-y-2">
            {contacts.data?.map((contact) => (
              <li key={contact.id}>
                <button
                  aria-pressed={selected?.id === contact.id}
                  className="w-full rounded-md border px-3 py-2 text-left text-sm aria-pressed:bg-accent"
                  onClick={() => setSelectedId(contact.id)}
                  type="button"
                >
                  {contactLabel(contact)}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Companies" className="space-y-3">
          <h2 className="font-semibold text-xl">Companies</h2>
          {companies.data?.length === 0 ? <p>No Companies yet.</p> : null}
          <ul className="space-y-2">
            {companies.data?.map((company) => (
              <CompanyItem company={company} key={company.id} />
            ))}
          </ul>
        </section>
      </div>
      <DuplicateCandidates
        candidates={candidates.data ?? []}
        contacts={contacts.data ?? []}
        onOpen={setSelectedId}
      />
      {selected ? (
        <ContactProfile
          companies={companies.data ?? []}
          contact={selected}
          onCompanyChange={changeCompany}
          onUpdate={submitContactUpdate}
        />
      ) : null}
    </main>
  );
}

function DuplicateCandidates({
  candidates,
  contacts,
  onOpen,
}: {
  candidates: DuplicateCandidate[];
  contacts: Contact[];
  onOpen: (contactId: string) => void;
}) {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));

  return (
    <section aria-label="Duplicate candidates" className="space-y-3">
      <h2 className="font-semibold text-xl">Duplicate candidates</h2>
      {candidates.length === 0 ? <p>No duplicate candidates.</p> : null}
      <ul className="space-y-2">
        {candidates.map((candidate) => (
          <li
            className="rounded-md border px-3 py-2 text-sm"
            key={`${candidate.strength}-${candidate.contactIds.join("-")}`}
          >
            <span className="font-medium">
              {candidate.strength === "strong" ? "Strong" : "Weak suggestion"}
            </span>
            <span className="ml-2 text-muted-foreground">
              {candidate.reasons.join(", ")}
            </span>
            <ul className="mt-1 flex flex-wrap gap-2">
              {candidate.contactIds.map((contactId) => {
                const contact = byId.get(contactId);
                return contact ? (
                  <li key={contactId}>
                    <button
                      className="underline underline-offset-2"
                      onClick={() => onOpen(contactId)}
                      type="button"
                    >
                      {contactLabel(contact)}
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompanyItem({ company }: { company: Company }) {
  return (
    <li className="rounded-md border px-3 py-2 text-sm">
      {company.name}
      <span className="ml-2 text-muted-foreground">
        {company.contactCount} Contact{company.contactCount === 1 ? "" : "s"}
      </span>
    </li>
  );
}

function ContactProfile({
  companies,
  contact,
  onCompanyChange,
  onUpdate,
}: {
  companies: Company[];
  contact: Contact;
  onCompanyChange: (contact: Contact, companyId: string) => Promise<void>;
  onUpdate: (
    contact: Contact,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
}) {
  const past = contact.companyHistory.filter((entry) => entry.endedAt);

  return (
    <section
      aria-label={`Contact: ${contactLabel(contact)}`}
      className="space-y-4 border-t pt-6"
    >
      <h2 className="font-semibold text-xl">{contactLabel(contact)}</h2>
      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
        key={`${contact.id}-${contact.revision}`}
        onSubmit={(event) => onUpdate(contact, event)}
      >
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            className="rounded-md border bg-background px-3 py-2"
            defaultValue={contact.displayName ?? ""}
            maxLength={255}
            name="displayName"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="rounded-md border bg-background px-3 py-2"
            name="email"
            placeholder="Add an email"
            type="email"
          />
        </label>
        <button
          className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
          type="submit"
        >
          Save Contact
        </button>
      </form>
      <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Display name</dt>
        <dd>{contact.displayName ?? "None"}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>
          {contact.emails.length > 0 ? contact.emails.join(", ") : "None"}
        </dd>
        <dt className="text-muted-foreground">Belongs to Company</dt>
        <dd className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Belongs to Company"
            className="rounded-md border bg-background px-3 py-1"
            onChange={(event) => onCompanyChange(contact, event.target.value)}
            value={contact.company?.id ?? NO_COMPANY}
          >
            <option value={NO_COMPANY}>None</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </dd>
        {past.length > 0 ? (
          <>
            <dt className="text-muted-foreground">Past Companies</dt>
            <dd>{past.map((entry) => entry.company.name).join(", ")}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Persona</dt>
        <dd>
          {contact.personaDocuments.length === 0 ? "None" : null}
          <ul className="space-y-1">
            {contact.personaDocuments.map((persona) => (
              <li key={persona.documentId}>
                {persona.title}{" "}
                <Link
                  className="underline underline-offset-2"
                  hash={documentRecordHash(persona.documentId)}
                  params={{ projectId: persona.projectId }}
                  to="/projects/$projectId"
                >
                  Open Source Record
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </dl>
    </section>
  );
}
