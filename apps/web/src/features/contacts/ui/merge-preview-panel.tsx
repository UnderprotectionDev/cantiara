import type { Contact, MergePreview } from "@cantiara/api/contacts";

function contactLabel(contact: Pick<Contact, "displayName" | "emails">) {
  return contact.displayName ?? contact.emails[0] ?? "Unnamed Contact";
}

export default function MergePreviewPanel({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: MergePreview;
}) {
  return (
    <section
      aria-label="Merge Preview"
      className="space-y-3 rounded-md border px-4 py-3 text-sm"
    >
      <h3 className="font-semibold text-lg">Merge Preview</h3>
      <p>
        Surviving Contact: <strong>{contactLabel(preview.survivor)}</strong>.{" "}
        {contactLabel(preview.retired)} becomes a redirect to it; nothing is
        written until you confirm.
      </p>
      <dl className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted-foreground">Field conflicts</dt>
        <dd>
          {preview.fieldConflicts.length === 0 ? "None" : null}
          <ul>
            {preview.fieldConflicts.map((conflict) => (
              <li key={conflict.field}>
                {conflict.field}: keeps {conflict.survivorValue}, drops{" "}
                {conflict.retiredValue}
              </li>
            ))}
          </ul>
        </dd>
        <dt className="text-muted-foreground">Email aliases added</dt>
        <dd>
          {preview.addedEmails.length > 0
            ? preview.addedEmails.join(", ")
            : "None"}
        </dd>
        <dt className="text-muted-foreground">Feedback moved</dt>
        <dd>{preview.feedbackIds.length}</dd>
        <dt className="text-muted-foreground">Belongs to Company</dt>
        <dd>{preview.companyOutcome}</dd>
        <dt className="text-muted-foreground">Persona links added</dt>
        <dd>
          {preview.personaDocuments.length > 0
            ? preview.personaDocuments
                .map((persona) => persona.title)
                .join(", ")
            : "None"}
        </dd>
      </dl>
      <div className="flex gap-3">
        <button
          className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          Confirm Merge
        </button>
        <button
          className="rounded-md border px-3 py-2"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
