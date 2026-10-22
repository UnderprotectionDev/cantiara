// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected record and form field.
import {
  FEEDBACK_STATUSES,
  type FeedbackAttachment,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";
import {
  type ConfirmConvert,
  ConvertToWorkDialog,
  type PreviewConvert,
} from "../components/convert-to-work-dialog";
import {
  type IdentityOption,
  IdentitySelect,
} from "../components/identity-select";
import {
  CreateFeedbackForm,
  type FeedbackDraft,
} from "../forms/create-feedback-form";
import {
  EvidenceQualityPanel,
  type SaveEvidence,
} from "../forms/evidence-quality-form";

type SetIdentity = (
  record: FeedbackRecord,
  identity: { companyId: string | null; contactId: string | null },
) => Promise<unknown>;
type SetStatus = (
  record: FeedbackRecord,
  status: FeedbackStatus,
) => Promise<unknown>;

function FeedbackRow({
  companyOptions,
  contactOptions,
  onConfirmConvert,
  onPreviewConvert,
  onSaveEvidence,
  onSetIdentity,
  onSetStatus,
  readOnly,
  record,
}: {
  companyOptions: IdentityOption[];
  contactOptions: IdentityOption[];
  onConfirmConvert: (record: FeedbackRecord) => ConfirmConvert;
  onPreviewConvert: (record: FeedbackRecord) => PreviewConvert;
  onSaveEvidence: (record: FeedbackRecord) => SaveEvidence;
  onSetIdentity: SetIdentity;
  onSetStatus: SetStatus;
  readOnly: boolean;
  record: FeedbackRecord;
}) {
  const [error, setError] = useState<string>();
  const [converting, setConverting] = useState(false);
  async function changeIdentity(next: {
    companyId?: string | null;
    contactId?: string | null;
  }) {
    setError(undefined);
    try {
      await onSetIdentity(record, {
        companyId:
          next.companyId === undefined
            ? (record.company?.id ?? null)
            : next.companyId,
        contactId:
          next.contactId === undefined
            ? (record.contact?.id ?? null)
            : next.contactId,
      });
    } catch {
      setError(
        "Contact or Company could not be changed. Reload and try again.",
      );
    }
  }
  async function change(status: FeedbackStatus) {
    setError(undefined);
    try {
      await onSetStatus(record, status);
    } catch {
      setError("Status could not be changed. Reload and try again.");
    }
  }
  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`feedback-record-${record.id}`}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-medium">{record.title}</h4>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`feedback-status-${record.id}`}>Status</label>
          <NativeSelect
            disabled={readOnly}
            id={`feedback-status-${record.id}`}
            onChange={(event) => {
              change(event.target.value as FeedbackStatus).catch(
                () => undefined,
              );
            }}
            value={record.status}
          >
            {FEEDBACK_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {status}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm">{record.originalMessage}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <IdentitySelect
          disabled={readOnly}
          id={`feedback-contact-${record.id}`}
          label="Contact (optional)"
          onChange={(value) => {
            changeIdentity({ contactId: value || null }).catch(() => undefined);
          }}
          options={contactOptions}
          value={record.contact?.id ?? ""}
        />
        <IdentitySelect
          disabled={readOnly}
          id={`feedback-company-${record.id}`}
          label="Company (optional)"
          onChange={(value) => {
            changeIdentity({ companyId: value || null }).catch(() => undefined);
          }}
          options={companyOptions}
          value={record.company?.id ?? ""}
        />
      </div>
      <dl className="grid gap-1 text-muted-foreground text-xs">
        {record.channel ? (
          <div className="flex gap-2">
            <dt>Channel</dt>
            <dd>{record.channel}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt>Occurred at</dt>
          <dd>
            <time dateTime={record.occurredAt}>{record.occurredAt}</time>
          </dd>
        </div>
        {record.link ? (
          <div className="flex gap-2">
            <dt>Link</dt>
            <dd>
              <a
                className="underline"
                href={record.link}
                rel="noreferrer noopener"
                target="_blank"
              >
                {record.link}
              </a>
            </dd>
          </div>
        ) : null}
        {record.attachments.length > 0 ? (
          <div className="flex gap-2">
            <dt>Attachments</dt>
            <dd>{record.attachments.map(({ name }) => name).join(", ")}</dd>
          </div>
        ) : null}
      </dl>
      {record.workOrigins.length > 0 ? (
        <section aria-label="Origin of Work" className="space-y-1 text-sm">
          <h5 className="font-medium">Origin of</h5>
          <ul>
            {record.workOrigins.map((origin) => (
              <li className="space-y-2" key={origin.id}>
                <p>
                  {origin.workKey} {origin.workTitle}
                </p>
                <EvidenceQualityPanel
                  onSave={onSaveEvidence(record)}
                  origin={origin}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {readOnly ? null : (
        <Button
          onClick={() => setConverting(true)}
          type="button"
          variant="outline"
        >
          Convert to Work
        </Button>
      )}
      {converting ? (
        <ConvertToWorkDialog
          onClose={() => setConverting(false)}
          onConfirm={onConfirmConvert(record)}
          onPreview={onPreviewConvert(record)}
          record={record}
        />
      ) : null}
    </li>
  );
}

export function FeedbackView({
  attachmentOptions,
  companyOptions,
  contactOptions,
  onConfirmConvert,
  onCreate,
  onPreviewConvert,
  onSaveEvidence,
  onSetIdentity,
  onSetStatus,
  readOnly,
  records,
}: {
  attachmentOptions: FeedbackAttachment[];
  companyOptions: IdentityOption[];
  contactOptions: IdentityOption[];
  onConfirmConvert: (record: FeedbackRecord) => ConfirmConvert;
  onCreate: (draft: FeedbackDraft) => Promise<unknown>;
  onPreviewConvert: (record: FeedbackRecord) => PreviewConvert;
  onSaveEvidence: (record: FeedbackRecord) => SaveEvidence;
  onSetIdentity: SetIdentity;
  onSetStatus: SetStatus;
  readOnly: boolean;
  records: FeedbackRecord[];
}) {
  return (
    <section aria-labelledby="feedback-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="feedback-heading">
        Feedback
      </h2>
      {readOnly ? null : (
        <CreateFeedbackForm
          attachmentOptions={attachmentOptions}
          companyOptions={companyOptions}
          contactOptions={contactOptions}
          onCreate={onCreate}
        />
      )}
      {records.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <FeedbackRow
              companyOptions={companyOptions}
              contactOptions={contactOptions}
              key={record.id}
              onConfirmConvert={onConfirmConvert}
              onPreviewConvert={onPreviewConvert}
              onSaveEvidence={onSaveEvidence}
              onSetIdentity={onSetIdentity}
              onSetStatus={onSetStatus}
              readOnly={readOnly}
              record={record}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
