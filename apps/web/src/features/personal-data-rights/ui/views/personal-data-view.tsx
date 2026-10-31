// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import {
  EXPORT_PERSONAL_DATA_LABEL,
  type PersonalDataArtifact,
  type PersonalDataFormat,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { usePersonalDataFlow } from "../../hooks/use-personal-data-flow";
import { PersonalDataPreviewPanel } from "../components/personal-data-preview-panel";
import { PersonalDataContactForm } from "../forms/personal-data-contact-form";

/**
 * Hesap ve kişisel veri: `Export Personal Data` collects one Contact's own
 * record, email aliases, Feedback, Research and related evidence into a
 * readable package after a closed-world preview. It is not a Workspace Exit
 * Package, not Account closure and not a restore format.
 */
export function PersonalDataView({
  contacts,
  onPreview,
  onProduce,
}: {
  contacts: ReadonlyArray<{ id: string; label: string }>;
  onPreview: (contactId: string) => Promise<PersonalDataPreview>;
  onProduce: (
    preview: PersonalDataPreview,
    format: PersonalDataFormat,
  ) => Promise<PersonalDataArtifact>;
}) {
  const flow = usePersonalDataFlow({ onPreview, onProduce });
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-semibold text-lg">{EXPORT_PERSONAL_DATA_LABEL}</h2>
        <p className="text-muted-foreground text-sm">
          Collect one Contact's own data into a readable package. You review
          exactly which sources go in before anything is produced. Only add data
          about other people that you collected lawfully.
        </p>
      </header>
      <PersonalDataContactForm
        contacts={contacts}
        disabled={flow.pending}
        onPreview={(contactId) => {
          flow.review(contactId).catch(() => undefined);
        }}
      />
      {flow.refusal ? (
        <p className="text-sm" role="alert">
          {flow.refusal}
        </p>
      ) : null}
      {flow.preview ? (
        <PersonalDataPreviewPanel
          disabled={flow.pending}
          onCancel={flow.cancel}
          onConfirm={(format) => {
            flow.confirm(format).catch(() => undefined);
          }}
          preview={flow.preview}
          produced={flow.produced}
        />
      ) : null}
      <p aria-live="polite" className="sr-only">
        {flow.pending ? "Working…" : ""}
      </p>
    </div>
  );
}
