// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  type Company,
  type Contact,
  createCompanyInputSchema,
  createContactInputSchema,
  type DuplicateCandidate,
  type ParsedCreateCompanyInput,
  type ParsedCreateContactInput,
  type ParsedUpdateContactInput,
  updateContactInputSchema,
} from "@cantiara/api/contacts";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId } from "react";
import { contactLabel, NO_COMPANY } from "../../lib/contact-label";

function handleFormSubmit(form: { handleSubmit: () => Promise<void> }) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  };
}

export function CreateContactForm({
  companies,
  onCreate,
  onInvalid,
}: {
  companies: Company[] | undefined;
  onCreate: (input: ParsedCreateContactInput) => Promise<boolean>;
  onInvalid: (message: string) => void;
}) {
  const contactForm = useForm({
    defaultValues: { companyId: NO_COMPANY, displayName: "", email: "" },
    onSubmit: async ({ value, formApi }) => {
      const displayName = value.displayName.trim();
      const email = value.email.trim();
      const parsed = createContactInputSchema.safeParse({
        ...(value.companyId ? { companyId: value.companyId } : {}),
        ...(displayName ? { displayName } : {}),
        ...(email ? { email } : {}),
      });
      if (!parsed.success) {
        onInvalid(parsed.error.issues[0]?.message ?? "Contact is invalid.");
        return;
      }
      if (await onCreate(parsed.data)) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleFormSubmit(contactForm)}
    >
      <contactForm.Field name="displayName">
        {(field) => (
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="create-contact-display-name"
          >
            Display name
            <Input
              id="create-contact-display-name"
              maxLength={255}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </contactForm.Field>
      <contactForm.Field name="email">
        {(field) => (
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="create-contact-email"
          >
            Email
            <Input
              id="create-contact-email"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              type="email"
              value={field.state.value}
            />
          </label>
        )}
      </contactForm.Field>
      <contactForm.Field name="companyId">
        {(field) => (
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="create-contact-company"
          >
            Company
            <NativeSelect
              className="w-full"
              id="create-contact-company"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value={NO_COMPANY}>None</NativeSelectOption>
              {companies?.map((company) => (
                <NativeSelectOption key={company.id} value={company.id}>
                  {company.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </contactForm.Field>
      <button
        className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
        type="submit"
      >
        Create Contact
      </button>
    </form>
  );
}

export function CreateCompanyForm({
  onCreate,
  onInvalid,
}: {
  onCreate: (input: ParsedCreateCompanyInput) => Promise<boolean>;
  onInvalid: (message: string) => void;
}) {
  const companyForm = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      const parsed = createCompanyInputSchema.safeParse({ name: value.name });
      if (!parsed.success) {
        onInvalid(parsed.error.issues[0]?.message ?? "Company is invalid.");
        return;
      }
      if (await onCreate(parsed.data)) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleFormSubmit(companyForm)}
    >
      <companyForm.Field name="name">
        {(field) => (
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="create-company-name"
          >
            Company name
            <Input
              id="create-company-name"
              maxLength={255}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </companyForm.Field>
      <button
        className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
        type="submit"
      >
        Create Company
      </button>
    </form>
  );
}

export function MergeStarterForm({
  byId,
  candidate,
  onMerge,
}: {
  byId: Map<string, Contact>;
  candidate: DuplicateCandidate;
  onMerge: (survivorId: string, retiredId: string) => void;
}) {
  const selectId = useId();
  const form = useForm({
    defaultValues: { survivorId: candidate.contactIds[0] ?? "" },
    onSubmit: ({ value }) => {
      const retiredId =
        candidate.contactIds.find((id) => id !== value.survivorId) ??
        value.survivorId;
      onMerge(value.survivorId, retiredId);
    },
  });

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-3"
      onSubmit={handleFormSubmit(form)}
    >
      <form.Field name="survivorId">
        {(field) => (
          <label className="flex items-center gap-2" htmlFor={selectId}>
            Surviving Contact
            <NativeSelect
              id={selectId}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              {candidate.contactIds.map((id) => {
                const contact = byId.get(id);
                return contact ? (
                  <NativeSelectOption key={id} value={id}>
                    {contactLabel(contact)}
                  </NativeSelectOption>
                ) : null;
              })}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <button className="rounded-md border px-3 py-1" type="submit">
        Merge Contacts
      </button>
    </form>
  );
}

export function ContactUpdateForm({
  contact,
  onInvalid,
  onUpdate,
}: {
  contact: Contact;
  onInvalid: (message: string) => void;
  onUpdate: (input: ParsedUpdateContactInput) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { displayName: contact.displayName ?? "", email: "" },
    onSubmit: ({ value }) => {
      const displayName = value.displayName.trim();
      const email = value.email.trim();
      const parsed = updateContactInputSchema.safeParse({
        contactId: contact.id,
        displayName: displayName || null,
        ...(email ? { email } : {}),
        expectedRevision: contact.revision,
      });
      if (!parsed.success) {
        onInvalid(parsed.error.issues[0]?.message ?? "Contact is invalid.");
        return;
      }
      return onUpdate(parsed.data);
    },
  });

  return (
    <form
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
      onSubmit={handleFormSubmit(form)}
    >
      <form.Field name="displayName">
        {(field) => (
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="contact-update-display-name"
          >
            Display name
            <Input
              id="contact-update-display-name"
              maxLength={255}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="email">
        {(field) => (
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="contact-update-email"
          >
            Email
            <Input
              id="contact-update-email"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Add an email"
              type="email"
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <button
        className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
        type="submit"
      >
        Save Contact
      </button>
    </form>
  );
}
