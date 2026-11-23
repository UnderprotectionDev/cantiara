// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected record and form field.

import {
  FEEDBACK_STATUSES,
  type FeedbackAttachment,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@cantiara/api/feedback";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  VirtualList,
  type VirtualListReveal,
  type VirtualRowProps,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
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

interface FeedbackWriteState {
  error: unknown;
  isPending: boolean;
  variables?: { feedbackId: string };
}

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
  identityWrite,
  statusWrite,
  rowProps,
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
  identityWrite?: FeedbackWriteState;
  statusWrite?: FeedbackWriteState;
  rowProps?: VirtualRowProps;
}) {
  const disableWrite =
    readOnly || statusWrite?.isPending || identityWrite?.isPending;
  let error: string | undefined;
  if (statusWrite?.error) {
    error = "Status could not be changed. Reload and try again.";
  } else if (identityWrite?.error) {
    error = "Contact or Company could not be changed. Reload and try again.";
  }
  function changeIdentity(next: {
    companyId?: string | null;
    contactId?: string | null;
  }) {
    return onSetIdentity(record, {
      companyId:
        next.companyId === undefined
          ? (record.company?.id ?? null)
          : next.companyId,
      contactId:
        next.contactId === undefined
          ? (record.contact?.id ?? null)
          : next.contactId,
    }).catch(() => undefined);
  }
  function change(status: FeedbackStatus) {
    return onSetStatus(record, status).catch(() => undefined);
  }
  return (
    <li
      {...rowProps}
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`feedback-record-${record.id}`}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-medium">{record.title}</h4>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`feedback-status-${record.id}`}>Status</label>
          <NativeSelect
            disabled={disableWrite}
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
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-sm whitespace-pre-wrap">{record.originalMessage}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <IdentitySelect
          disabled={disableWrite}
          id={`feedback-contact-${record.id}`}
          label="Contact (optional)"
          onChange={(value) => {
            changeIdentity({ contactId: value || null }).catch(() => undefined);
          }}
          options={contactOptions}
          value={record.contact?.id ?? ""}
        />
        <IdentitySelect
          disabled={disableWrite}
          id={`feedback-company-${record.id}`}
          label="Company (optional)"
          onChange={(value) => {
            changeIdentity({ companyId: value || null }).catch(() => undefined);
          }}
          options={companyOptions}
          value={record.company?.id ?? ""}
        />
      </div>
      <dl className="grid gap-1 text-xs text-muted-foreground">
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
          <VirtualList
            estimateSize={60}
            gap={8}
            getKey={virtualRowId}
            rows={record.workOrigins}
          >
            {(origin, originRowProps) => (
              <li className="space-y-2" {...originRowProps}>
                <p>
                  {origin.workKey} {origin.workTitle}
                </p>
                <EvidenceQualityPanel
                  onSave={onSaveEvidence(record)}
                  origin={origin}
                  readOnly={readOnly}
                />
              </li>
            )}
          </VirtualList>
        </section>
      ) : null}
      {readOnly ? null : (
        <ConvertToWorkDialog
          onConfirm={onConfirmConvert(record)}
          onPreview={onPreviewConvert(record)}
          record={record}
        />
      )}
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
  identityWrite,
  statusWrite,
  readOnly,
  records,
  reveal,
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
  identityWrite?: FeedbackWriteState;
  statusWrite?: FeedbackWriteState;
  readOnly: boolean;
  records: FeedbackRecord[];
  reveal?: VirtualListReveal;
}) {
  return (
    <section aria-labelledby="feedback-heading" className="space-y-4">
      <h2 className="text-lg font-semibold" id="feedback-heading">
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
        <p className="text-sm text-muted-foreground">No Feedback yet.</p>
      ) : (
        <VirtualList
          className="space-y-3"
          estimateSize={120}
          gap={8}
          getKey={virtualRowId}
          reveal={reveal}
          rows={records}
        >
          {(record, rowProps) => (
            <FeedbackRow
              companyOptions={companyOptions}
              contactOptions={contactOptions}
              identityWrite={
                identityWrite?.variables?.feedbackId === record.id
                  ? identityWrite
                  : undefined
              }
              onConfirmConvert={onConfirmConvert}
              onPreviewConvert={onPreviewConvert}
              onSaveEvidence={onSaveEvidence}
              onSetIdentity={onSetIdentity}
              onSetStatus={onSetStatus}
              readOnly={readOnly}
              record={record}
              rowProps={rowProps}
              statusWrite={
                statusWrite?.variables?.feedbackId === record.id
                  ? statusWrite
                  : undefined
              }
            />
          )}
        </VirtualList>
      )}
    </section>
  );
}
