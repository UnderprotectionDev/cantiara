// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import {
  ERASE_PERSONAL_DATA_LABEL,
  EXPORT_PERSONAL_DATA_LABEL,
  PERSONAL_DATA_COPIES_REMOVED_LABEL,
  PERSONAL_DATA_SPECIAL_CATEGORY_WARNING,
  type PersonalDataArtifact,
  type PersonalDataErasePreview,
  type PersonalDataEraseResult,
  type PersonalDataFormat,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { usePersonalDataEraseFlow } from "../../hooks/use-personal-data-erase-flow";
import { usePersonalDataFlow } from "../../hooks/use-personal-data-flow";
import { PersonalDataPreviewPanel } from "../components/personal-data-preview-panel";
import { PersonalDataContactForm } from "../forms/personal-data-contact-form";
import { PersonalDataEraseForm } from "../forms/personal-data-erase-form";

/**
 * Hesap ve kişisel veri: `Export Personal Data` collects one Contact's own
 * record, email aliases, Feedback, Research and related evidence into a
 * readable package after a closed-world preview; `Erase Personal Data` removes
 * the same person through Security Redaction after the GitHub identity step
 * and the typed Account name. Neither is a Workspace Exit Package, Trash or
 * Account closure, and the package is not a restore format.
 */
export function PersonalDataView({
  contacts,
  onConfirmIdentity,
  onErase,
  onPreview,
  onPreviewErase,
  onProduce,
}: {
  contacts: ReadonlyArray<{ id: string; label: string }>;
  onConfirmIdentity: () => Promise<string>;
  onErase: (
    preview: PersonalDataErasePreview,
    confirmation: { grant: string; typedName: string },
  ) => Promise<PersonalDataEraseResult>;
  onPreview: (contactId: string) => Promise<PersonalDataPreview>;
  onPreviewErase: (contactId: string) => Promise<PersonalDataErasePreview>;
  onProduce: (
    preview: PersonalDataPreview,
    format: PersonalDataFormat,
  ) => Promise<PersonalDataArtifact>;
}) {
  const flow = usePersonalDataFlow({ onPreview, onProduce });
  const erase = usePersonalDataEraseFlow({
    onConfirmIdentity,
    onErase,
    onPreview: onPreviewErase,
  });
  const busy = flow.pending || erase.pending;
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-semibold text-lg">{EXPORT_PERSONAL_DATA_LABEL}</h2>
        <p className="text-muted-foreground text-sm">
          Collect one Contact's own data into a readable package. You review
          exactly which sources go in before anything is produced.{" "}
          {ERASE_PERSONAL_DATA_LABEL} removes that person after you review the
          impact.
        </p>
        <p className="text-muted-foreground text-sm">
          {PERSONAL_DATA_SPECIAL_CATEGORY_WARNING}
        </p>
      </header>
      <PersonalDataContactForm
        contacts={contacts}
        disabled={busy}
        onPreview={(contactId) => {
          erase.cancel();
          flow.review(contactId).catch(() => undefined);
        }}
        onPreviewErase={(contactId) => {
          flow.cancel();
          erase.review(contactId).catch(() => undefined);
        }}
      />
      {flow.refusal ? (
        <p className="text-sm" role="alert">
          {flow.refusal}
        </p>
      ) : null}
      {erase.refusal ? (
        <p className="text-sm" role="alert">
          {erase.refusal}
        </p>
      ) : null}
      {flow.preview ? (
        <PersonalDataPreviewPanel
          disabled={busy}
          onCancel={flow.cancel}
          onConfirm={(format) => {
            flow.confirm(format).catch(() => undefined);
          }}
          preview={flow.preview}
          produced={flow.produced}
        />
      ) : null}
      {erase.preview ? (
        <PersonalDataEraseForm
          busy={busy}
          grant={erase.grant}
          identityPending={erase.identityPending}
          onCancel={erase.cancel}
          onConfirmIdentity={() => {
            erase.confirmIdentity().catch(() => undefined);
          }}
          onErase={(typedName) => {
            erase.erase(typedName).catch(() => undefined);
          }}
          preview={erase.preview}
        />
      ) : null}
      {erase.result ? (
        <p className="text-sm" role="status">
          Personal data erased. {erase.result.tombstone.feedback} Feedback,{" "}
          {erase.result.tombstone.research} Research and{" "}
          {erase.result.tombstone.emailAliases} email aliases were cleared; a
          content-free tombstone remains.
          {erase.result.removal.some(
            (target) =>
              target.copies > 0 &&
              (target.kind === "external-surface-snapshot" ||
                target.kind === "cache"),
          )
            ? ` ${PERSONAL_DATA_COPIES_REMOVED_LABEL}`
            : ""}
          {erase.result.notRedacted > 0
            ? ` ${erase.result.notRedacted} long original ${erase.result.notRedacted === 1 ? "message was" : "messages were"} not searched for in shared copies.`
            : ""}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {busy ? "Working…" : ""}
      </p>
    </div>
  );
}
