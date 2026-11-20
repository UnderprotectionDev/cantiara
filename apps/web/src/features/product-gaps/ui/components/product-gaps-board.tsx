// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the selected Gap.
import {
  PRODUCT_GAP_LABEL,
  PRODUCT_GAP_STATUSES,
  type ProductGapFollowUpPlan,
  type ProductGapRecord,
  type ProductGapStatus,
} from "@cantiara/api/product-gaps";
import { Alert } from "@cantiara/ui/components/alert";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useId } from "react";
import {
  EMPTY_GAP_FILTER,
  errorText,
  type GapFilterValues,
  linkLabel,
} from "../../lib/product-gap-form";
import {
  type ConfirmFollowUp,
  FollowUpPanel,
  type PreviewFollowUp,
} from "../forms/product-gap-follow-up-form";
import type { LoadProductGapTargets } from "../forms/product-gap-links-field-form";
import {
  type RecordGap,
  RecordProductGapForm,
} from "../forms/record-product-gap-form";
import type { CloseEscape } from "../forms/tool-escape-close-form";
import {
  GapFilterBar,
  type LoadEscapes,
  ToolEscapesPanel,
} from "./dogfooding-summary";

export type { RecordGap } from "../forms/record-product-gap-form";
export type { CloseEscape } from "../forms/tool-escape-close-form";
export type { LoadEscapes } from "./dogfooding-summary";

export type SetGapStatus = (
  gap: ProductGapRecord,
  status: ProductGapStatus,
) => Promise<unknown>;

interface GapWriteState {
  error: unknown;
  isPending: boolean;
  isSuccess: boolean;
  variables?: { gapId: string; status?: ProductGapStatus };
}

function StatusControl({
  onSetStatus,
  record,
  write,
}: {
  onSetStatus: SetGapStatus;
  write?: GapWriteState;
  record: ProductGapRecord;
}) {
  const id = useId();
  const error = write?.error
    ? errorText(write.error, `${PRODUCT_GAP_LABEL} was not updated.`)
    : undefined;
  const message = write?.isSuccess
    ? `Status changed to ${write.variables?.status}.`
    : "";
  return (
    <Field className="gap-1 text-sm">
      <FieldLabel
        htmlFor={`${id}-status`}
      >{`Status of ${record.title}`}</FieldLabel>
      <NativeSelect
        disabled={write?.isPending}
        id={`${id}-status`}
        onChange={(event) =>
          onSetStatus(record, event.target.value as ProductGapStatus).catch(
            () => undefined,
          )
        }
        value={record.status}
      >
        {PRODUCT_GAP_STATUSES.map((status) => (
          <NativeSelectOption key={status} value={status}>
            {status}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <p aria-live="polite" className="text-muted-foreground" role="status">
        {message}
      </p>
    </Field>
  );
}

export function ProductGapsBoard({
  filter = EMPTY_GAP_FILTER,
  formatDateTime,
  gaps,
  loadEscapes,
  loadTargets,
  onCloseEscape,
  onConfirmFollowUp,
  onFilterChange,
  onPreviewFollowUp,
  onRecord,
  onSetStatus,
  statusWrite,
  followUpWrite,
  tools,
}: {
  filter?: GapFilterValues;
  /** Formats event and close times with the account `Locale`/`Date format`. */
  formatDateTime: (value: string) => string;
  gaps: ProductGapRecord[];
  loadEscapes: LoadEscapes;
  loadTargets: LoadProductGapTargets;
  onCloseEscape?: CloseEscape;
  onConfirmFollowUp: ConfirmFollowUp;
  onFilterChange: (filter: GapFilterValues) => void;
  onPreviewFollowUp: PreviewFollowUp;
  onRecord: RecordGap;
  onSetStatus: SetGapStatus;
  statusWrite?: GapWriteState;
  followUpWrite?: GapWriteState & {
    reset: () => void;
    variables?: { gapId: string; plan: ProductGapFollowUpPlan };
  };
  tools: string[];
}) {
  const filtering = Object.values(filter).some(Boolean);
  return (
    <section aria-labelledby="product-gaps-heading" className="space-y-6">
      <h2 className="text-lg font-semibold" id="product-gaps-heading">
        Product Gaps
      </h2>
      <RecordProductGapForm
        gaps={gaps}
        loadTargets={loadTargets}
        onSubmit={onRecord}
      />
      <GapFilterBar
        filter={filter}
        loadTargets={loadTargets}
        onChange={onFilterChange}
        tools={tools}
      />
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filtering
            ? "No Product Gaps match these filters."
            : "No Product Gaps recorded yet."}
        </p>
      ) : (
        <ul aria-label="Product Gaps" className="space-y-4">
          {gaps.map((record) => (
            <li
              className="space-y-3 rounded-lg border border-border/70 p-5"
              key={record.id}
            >
              <article aria-label={record.title} className="space-y-3">
                <h3 className="font-medium">{record.title}</h3>
                <p className="text-sm whitespace-pre-wrap">
                  {record.unmetNeed}
                </p>
                {record.scope ? (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{`Scope: ${record.scope}`}</p>
                ) : null}
                {record.links.length === 0 ? null : (
                  <ul
                    aria-label={`Related records of ${record.title}`}
                    className="space-y-1 text-sm"
                  >
                    {record.links.map((link) => (
                      <li key={link.id}>{linkLabel(link)}</li>
                    ))}
                  </ul>
                )}
                <ToolEscapesPanel
                  filter={filter}
                  formatDateTime={formatDateTime}
                  key={`${record.id}:${record.escapeCount}:${JSON.stringify(filter)}`}
                  loadEscapes={loadEscapes}
                  loadTargets={loadTargets}
                  onCloseEscape={onCloseEscape}
                  record={record}
                />
                <StatusControl
                  onSetStatus={onSetStatus}
                  record={record}
                  write={
                    statusWrite?.variables?.gapId === record.id
                      ? statusWrite
                      : undefined
                  }
                />
                <FollowUpPanel
                  loadTargets={loadTargets}
                  onConfirm={onConfirmFollowUp}
                  onPreview={onPreviewFollowUp}
                  record={record}
                  write={
                    followUpWrite?.variables?.gapId === record.id
                      ? followUpWrite
                      : undefined
                  }
                />
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
