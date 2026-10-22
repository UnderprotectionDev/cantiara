// biome-ignore-all lint/performance/noJsxPropsBind: Contact controls act on the selected Contact and Company.

import type {
  Company,
  Contact,
  DuplicateCandidate,
  ParsedCreateCompanyInput,
  ParsedCreateContactInput,
  ParsedUpdateContactInput,
} from "@cantiara/api/contacts";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { contactLabel, NO_COMPANY } from "../../lib/contact-label";
import MergePreviewPanel, {
  mergeContactsRequest,
} from "../components/merge-preview-panel";
import MergeUndoPanel, {
  undoMergeRequest,
  undoResultNotice,
} from "../components/merge-undo-panel";
import {
  ContactUpdateForm,
  CreateCompanyForm,
  CreateContactForm,
  MergeStarterForm,
} from "../forms/contact-form";

/** Null once the preview is unavailable: the message under the panel says so. */
export function undoFailureMessage(previewUnavailable: boolean) {
  return previewUnavailable
    ? null
    : "Merge could not be undone. The Undo Merge Preview was refreshed; review it and confirm again.";
}

export default function ContactsView({ contactId }: { contactId?: string }) {
  const queryClient = useQueryClient();
  const contacts = useQuery(orpc.contacts.queryOptions());
  const companies = useQuery(orpc.companies.queryOptions());
  const candidates = useQuery(orpc.contactDuplicateCandidates.queryOptions());
  const opened = useQuery({
    ...orpc.resolveContact.queryOptions({
      input: { contactId: contactId ?? "" },
    }),
    enabled: contactId !== undefined,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected =
    contacts.data?.find(
      (contact) => contact.id === (selectedId ?? opened.data?.contact.id),
    ) ?? contacts.data?.[0];

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
  const [mergePair, setMergePair] = useState<{
    retiredId: string;
    survivorId: string;
  } | null>(null);
  const mergePreview = useQuery({
    ...orpc.contactMergePreview.queryOptions({
      input: mergePair ?? { retiredId: "", survivorId: "" },
    }),
    enabled: mergePair !== null,
  });
  const mergeContacts = useMutation({
    mutationFn: (input: Parameters<typeof client.mergeContacts>[0]) =>
      runOnlineOnlyWrite(() => client.mergeContacts(input)),
    onSuccess: async (result) => {
      setMergePair(null);
      setSelectedId(result.survivor.id);
      await refresh();
    },
  });
  const [undoRetiredId, setUndoRetiredId] = useState<string | null>(null);
  const [undoNotice, setUndoNotice] = useState<string | null>(null);
  const undoPreview = useQuery({
    ...orpc.contactMergeUndoPreview.queryOptions({
      input: { retiredId: undoRetiredId ?? "" },
    }),
    enabled: undoRetiredId !== null,
    retry: false,
  });
  const undoMerge = useMutation({
    mutationFn: (input: Parameters<typeof client.undoMerge>[0]) =>
      runOnlineOnlyWrite(() => client.undoMerge(input)),
    onSuccess: async (result) => {
      setUndoRetiredId(null);
      setUndoNotice(undoResultNotice(result));
      setSelectedId(result.restored.id);
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({
          queryKey: orpc.resolveContact.queryOptions({
            input: { contactId: contactId ?? "" },
          }).queryKey,
        }),
      ]);
    },
  });
  const updateContact = useMutation({
    mutationFn: (input: Parameters<typeof client.updateContact>[0]) =>
      runOnlineOnlyWrite(() => client.updateContact(input)),
    onSuccess: refresh,
  });

  async function submitContactUpdate(input: ParsedUpdateContactInput) {
    setError(null);
    try {
      await updateContact.mutateAsync(input);
    } catch {
      setError("Contact could not be saved.");
    }
  }

  async function submitContactCreate(input: ParsedCreateContactInput) {
    setError(null);
    try {
      await createContact.mutateAsync(input);
      return true;
    } catch {
      setError("Contact could not be created.");
      return false;
    }
  }

  async function submitCompanyCreate(input: ParsedCreateCompanyInput) {
    setError(null);
    try {
      await createCompany.mutateAsync(input);
      return true;
    } catch {
      setError("Company could not be created.");
      return false;
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
      <p className="text-muted-foreground text-sm" role="status">
        {undoNotice}
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label="Create Contact" className="space-y-4">
          <h2 className="font-semibold text-xl">Create Contact</h2>
          <CreateContactForm
            companies={companies.data}
            onCreate={submitContactCreate}
            onInvalid={setError}
          />
        </section>
        <section aria-label="Create Company" className="space-y-4">
          <h2 className="font-semibold text-xl">Create Company</h2>
          <CreateCompanyForm
            onCreate={submitCompanyCreate}
            onInvalid={setError}
          />
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
        onMerge={(survivorId, retiredId) =>
          setMergePair({ retiredId, survivorId })
        }
        onOpen={setSelectedId}
      />
      {mergePair && mergePreview.data ? (
        <MergePreviewPanel
          onCancel={() => setMergePair(null)}
          onConfirm={async () => {
            setError(null);
            try {
              await mergeContacts.mutateAsync(
                mergeContactsRequest(mergePair, mergePreview.data),
              );
            } catch {
              setError(
                "Contacts could not be merged. The Merge Preview was refreshed; review it and confirm again.",
              );
              await mergePreview.refetch();
            }
          }}
          pending={mergeContacts.isPending}
          preview={mergePreview.data}
        />
      ) : null}
      {undoRetiredId && undoPreview.data && !undoPreview.isError ? (
        <MergeUndoPanel
          key={undoPreview.data.mergeId}
          onCancel={() => setUndoRetiredId(null)}
          onConfirm={async (resolution) => {
            setError(null);
            try {
              await undoMerge.mutateAsync(
                undoMergeRequest(undoPreview.data, resolution),
              );
            } catch {
              const refreshed = await undoPreview.refetch();
              setError(undoFailureMessage(refreshed.isError));
            }
          }}
          pending={undoMerge.isPending}
          preview={undoPreview.data}
        />
      ) : null}
      {undoRetiredId && undoPreview.isError ? (
        <p className="text-destructive text-sm" role="alert">
          This merge can no longer be undone from here.
        </p>
      ) : null}
      {opened.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Contact is unavailable.
        </p>
      ) : null}
      {opened.data?.redirectedFrom &&
      selected?.id === opened.data.contact.id ? (
        <p className="text-muted-foreground text-sm" role="status">
          Redirected from <code>{opened.data.redirectedFrom}</code>{" "}
          <button
            className="rounded-md border px-2 py-1"
            onClick={() => {
              setUndoNotice(null);
              setUndoRetiredId(opened.data.redirectedFrom);
            }}
            type="button"
          >
            Undo Merge
          </button>
        </p>
      ) : null}
      {selected ? (
        <ContactProfile
          companies={companies.data ?? []}
          contact={selected}
          onCompanyChange={changeCompany}
          onInvalid={setError}
          onUpdate={submitContactUpdate}
        />
      ) : null}
    </main>
  );
}

function DuplicateCandidates({
  candidates,
  contacts,
  onMerge,
  onOpen,
}: {
  candidates: DuplicateCandidate[];
  contacts: Contact[];
  onMerge: (survivorId: string, retiredId: string) => void;
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
              {candidate.strength === "strong"
                ? "Strong copy candidate"
                : "Weak suggestion"}
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
            {candidate.strength === "strong" ? (
              <MergeStarterForm
                byId={byId}
                candidate={candidate}
                onMerge={onMerge}
              />
            ) : null}
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
  onInvalid,
  onUpdate,
}: {
  companies: Company[];
  contact: Contact;
  onCompanyChange: (contact: Contact, companyId: string) => Promise<void>;
  onInvalid: (message: string) => void;
  onUpdate: (input: ParsedUpdateContactInput) => Promise<void>;
}) {
  const past = contact.companyHistory.filter((entry) => entry.endedAt);

  return (
    <section
      aria-label={`Contact: ${contactLabel(contact)}`}
      className="space-y-4 border-t pt-6"
    >
      <h2 className="font-semibold text-xl">{contactLabel(contact)}</h2>
      <ContactUpdateForm
        contact={contact}
        key={`${contact.id}-${contact.revision}`}
        onInvalid={onInvalid}
        onUpdate={onUpdate}
      />
      <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Display name</dt>
        <dd>{contact.displayName ?? "None"}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>
          {contact.emails.length > 0 ? contact.emails.join(", ") : "None"}
        </dd>
        <dt className="text-muted-foreground">Belongs to Company</dt>
        <dd className="flex flex-wrap items-center gap-3">
          <NativeSelect
            aria-label="Belongs to Company"
            onChange={(event) => onCompanyChange(contact, event.target.value)}
            value={contact.company?.id ?? NO_COMPANY}
          >
            <NativeSelectOption value={NO_COMPANY}>None</NativeSelectOption>
            {companies.map((company) => (
              <NativeSelectOption key={company.id} value={company.id}>
                {company.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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
