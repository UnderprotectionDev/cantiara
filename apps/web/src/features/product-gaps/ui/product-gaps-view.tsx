// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the selected Gap.
import {
  PRODUCT_GAP_FOLLOW_UP_WORK_TYPES,
  PRODUCT_GAP_LABEL,
  PRODUCT_GAP_STATUSES,
  type ProductGapFollowUpPlan,
  type ProductGapFollowUpWorkType,
  type ProductGapLinkTarget,
  type ProductGapRecord,
  type ProductGapStatus,
} from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useEffect, useId, useState } from "react";
import {
  EMPTY_GAP_FILTER,
  errorText,
  type GapFilterValues,
  linkLabel,
} from "../lib/product-gap-form";
import {
  GapFilterBar,
  type LoadEscapes,
  ToolEscapesPanel,
} from "./dogfooding-summary";
import type { LoadProductGapTargets } from "./product-gap-links-field";
import {
  type RecordGap,
  RecordProductGapForm,
} from "./record-product-gap-form";

import type { CloseEscape } from "./tool-escape-close";

export type { LoadEscapes } from "./dogfooding-summary";
export type { RecordGap } from "./record-product-gap-form";
export type { CloseEscape } from "./tool-escape-close";

export type FollowUpRequest =
  | { kind: "Feature relation"; featureId: string }
  | { kind: "Work"; projectId: string; workType: ProductGapFollowUpWorkType };

export type SetGapStatus = (
  gap: ProductGapRecord,
  status: ProductGapStatus,
) => Promise<unknown>;
export type PreviewFollowUp = (
  gap: ProductGapRecord,
  request: FollowUpRequest,
) => Promise<ProductGapFollowUpPlan>;
export type ConfirmFollowUp = (
  gap: ProductGapRecord,
  plan: ProductGapFollowUpPlan,
) => Promise<unknown>;

function StatusControl({
  onSetStatus,
  record,
}: {
  onSetStatus: SetGapStatus;
  record: ProductGapRecord;
}) {
  const id = useId();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState("");
  async function change(status: ProductGapStatus) {
    setError(undefined);
    setMessage("");
    try {
      await onSetStatus(record, status);
      setMessage(`Status changed to ${status}.`);
    } catch (caught) {
      setError(errorText(caught, `${PRODUCT_GAP_LABEL} was not updated.`));
    }
  }
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={`${id}-status`}>{`Status of ${record.title}`}</label>
      <NativeSelect
        id={`${id}-status`}
        onChange={(event) =>
          change(event.target.value as ProductGapStatus).catch(() => undefined)
        }
        value={record.status}
      >
        {PRODUCT_GAP_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </NativeSelect>
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground" role="status">
        {message}
      </p>
    </div>
  );
}

function PlanSummary({ plan }: { plan: ProductGapFollowUpPlan }) {
  if (plan.kind === "Feature relation") {
    return (
      <p>{`Relate Feature ${plan.feature.label} as a follow-up. No Work is created.`}</p>
    );
  }
  return (
    <div className="space-y-1">
      <p>{`Create 1 ${plan.work.type} in ${plan.targetProject.name}.`}</p>
      <p>{`Title: ${plan.work.title}`}</p>
      {plan.work.description ? (
        <p className="whitespace-pre-wrap">{`Description: ${plan.work.description}`}</p>
      ) : null}
    </div>
  );
}

/**
 * Optional follow-up. Nothing is written by choosing a target: the founder
 * reads the preview and confirms that exact plan, or discards it.
 */
function FollowUpPanel({
  loadTargets,
  onConfirm,
  onPreview,
  record,
}: {
  loadTargets: LoadProductGapTargets;
  onConfirm: ConfirmFollowUp;
  onPreview: PreviewFollowUp;
  record: ProductGapRecord;
}) {
  const id = useId();
  const [kind, setKind] = useState<"Feature relation" | "Work">("Work");
  const [workType, setWorkType] = useState<ProductGapFollowUpWorkType>("Task");
  const [targets, setTargets] = useState<ProductGapLinkTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [plan, setPlan] = useState<ProductGapFollowUpPlan | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    let current = true;
    setTargets([]);
    setTargetId("");
    setPlan(null);
    loadTargets(kind === "Work" ? "Project" : "Feature")
      .then((loaded) => {
        if (current) {
          setTargets(loaded);
        }
      })
      .catch(() => {
        if (current) {
          setError("Follow-up targets could not be loaded.");
        }
      });
    return () => {
      current = false;
    };
  }, [kind, loadTargets]);

  async function preview() {
    setError(undefined);
    setMessage("");
    try {
      setPlan(
        await onPreview(
          record,
          kind === "Work"
            ? { kind, projectId: targetId, workType }
            : { featureId: targetId, kind },
        ),
      );
    } catch (caught) {
      setError(errorText(caught, "The follow-up preview is unavailable."));
    }
  }

  async function confirm() {
    if (!plan) {
      return;
    }
    setError(undefined);
    try {
      await onConfirm(record, plan);
      setPlan(null);
      setTargetId("");
      setMessage(
        plan.kind === "Work"
          ? "Follow-up Work created."
          : "Follow-up Feature related.",
      );
    } catch (caught) {
      setPlan(null);
      setError(errorText(caught, "The follow-up was not created."));
    }
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3 text-sm">
      <legend className="px-1">{`Follow-up for ${record.title}`}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <label htmlFor={`${id}-kind`}>Follow-up kind</label>
          <NativeSelect
            id={`${id}-kind`}
            onChange={(event) =>
              setKind(event.target.value as "Feature relation" | "Work")
            }
            value={kind}
          >
            <option value="Work">Create follow-up work</option>
            <option value="Feature relation">Relate a Feature</option>
          </NativeSelect>
        </div>
        {kind === "Work" ? (
          <div className="grid gap-1">
            <label htmlFor={`${id}-type`}>Work type</label>
            <NativeSelect
              id={`${id}-type`}
              onChange={(event) => {
                setWorkType(event.target.value as ProductGapFollowUpWorkType);
                setPlan(null);
              }}
              value={workType}
            >
              {PRODUCT_GAP_FOLLOW_UP_WORK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="grid gap-1">
          <label htmlFor={`${id}-target`}>
            {kind === "Work" ? "Target Project" : "Feature"}
          </label>
          <NativeSelect
            id={`${id}-target`}
            onChange={(event) => {
              setTargetId(event.target.value);
              setPlan(null);
            }}
            value={targetId}
          >
            <option value="">
              {kind === "Work" ? "Choose a Project" : "Choose a Feature"}
            </option>
            {targets.map((target) => (
              <option key={target.targetId} value={target.targetId}>
                {target.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <Button
        disabled={!targetId}
        onClick={() => {
          preview().catch(() => undefined);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        Preview follow-up
      </Button>
      {plan ? (
        <section
          aria-label={`Follow-up preview for ${record.title}`}
          className="space-y-2 rounded-md bg-muted/40 p-3"
        >
          <PlanSummary plan={plan} />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                confirm().catch(() => undefined);
              }}
              size="sm"
              type="button"
            >
              Confirm follow-up
            </Button>
            <Button
              onClick={() => setPlan(null)}
              size="sm"
              type="button"
              variant="outline"
            >
              Discard preview
            </Button>
          </div>
        </section>
      ) : null}
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground" role="status">
        {message}
      </p>
    </fieldset>
  );
}

export function ProductGapsView({
  filter = EMPTY_GAP_FILTER,
  gaps,
  loadEscapes,
  loadTargets,
  onCloseEscape,
  onConfirmFollowUp,
  onFilterChange,
  onPreviewFollowUp,
  onRecord,
  onSetStatus,
  tools,
}: {
  filter?: GapFilterValues;
  gaps: ProductGapRecord[];
  loadEscapes: LoadEscapes;
  loadTargets: LoadProductGapTargets;
  onCloseEscape?: CloseEscape;
  onConfirmFollowUp: ConfirmFollowUp;
  onFilterChange: (filter: GapFilterValues) => void;
  onPreviewFollowUp: PreviewFollowUp;
  onRecord: RecordGap;
  onSetStatus: SetGapStatus;
  tools: string[];
}) {
  const filtering = Object.values(filter).some(Boolean);
  return (
    <section aria-labelledby="product-gaps-heading" className="space-y-6">
      <h2 className="font-semibold text-lg" id="product-gaps-heading">
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
        <p className="text-muted-foreground text-sm">
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
                <p className="whitespace-pre-wrap text-sm">
                  {record.unmetNeed}
                </p>
                {record.scope ? (
                  <p className="whitespace-pre-wrap text-muted-foreground text-sm">{`Scope: ${record.scope}`}</p>
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
                  key={`${record.id}:${record.escapeCount}:${JSON.stringify(filter)}`}
                  loadEscapes={loadEscapes}
                  loadTargets={loadTargets}
                  onCloseEscape={onCloseEscape}
                  record={record}
                />
                <StatusControl onSetStatus={onSetStatus} record={record} />
                <FollowUpPanel
                  loadTargets={loadTargets}
                  onConfirm={onConfirmFollowUp}
                  onPreview={onPreviewFollowUp}
                  record={record}
                />
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
