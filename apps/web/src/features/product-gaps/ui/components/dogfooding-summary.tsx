// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the filter and the selected Gap.
import {
  PRODUCT_GAP_STATUSES,
  type ProductGapRecord,
  TOOL_ESCAPE_LABEL,
  TOOL_ESCAPE_REASONS,
  type ToolEscapeRecord,
} from "@cantiara/api/product-gaps";
import { Alert } from "@cantiara/ui/components/alert";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { useProductGapLinkTargets } from "../../hooks/use-product-gap-link-targets";
import {
  errorText,
  type GapFilterValues,
  toListFilter,
} from "../../lib/product-gap-form";
import {
  type CloseEscape,
  ToolEscapeCloseForm,
} from "../forms/tool-escape-close-form";
import type { LoadProductGapTargets } from "./product-gap-links-field";
import { ToolEscapeCloseEvidence } from "./tool-escape-close";

export type LoadEscapes = (
  gap: ProductGapRecord,
  filter: GapFilterValues,
) => Promise<ToolEscapeRecord[]>;

/**
 * Dogfooding summary filters. They only select Gaps (and the events counted
 * under them); the list keeps the order of occurrence, newest first.
 */
export function GapFilterBar({
  filter,
  loadTargets,
  onChange,
  tools,
}: {
  filter: GapFilterValues;
  loadTargets: LoadProductGapTargets;
  onChange: (filter: GapFilterValues) => void;
  tools: string[];
}) {
  const { data: projects = [] } = useProductGapLinkTargets(
    loadTargets,
    "Project",
  );
  const set = (patch: Partial<GapFilterValues>) =>
    onChange({ ...filter, ...patch });
  return (
    <form
      aria-label="Filter Product Gaps"
      className="grid gap-3 rounded-lg border border-border/70 p-4 text-sm sm:grid-cols-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <Field className="gap-1">
        <FieldLabel htmlFor="product-gap-filter-tool">
          Filter by external tool
        </FieldLabel>
        <NativeSelect
          id="product-gap-filter-tool"
          onChange={(event) => set({ tool: event.target.value })}
          value={filter.tool}
        >
          <NativeSelectOption value="">Any tool</NativeSelectOption>
          {tools.map((tool) => (
            <NativeSelectOption key={tool} value={tool}>
              {tool}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="gap-1">
        <FieldLabel htmlFor="product-gap-filter-reason">
          Filter by reason
        </FieldLabel>
        <NativeSelect
          id="product-gap-filter-reason"
          onChange={(event) => set({ reason: event.target.value })}
          value={filter.reason}
        >
          <NativeSelectOption value="">Any reason</NativeSelectOption>
          {TOOL_ESCAPE_REASONS.map((reason) => (
            <NativeSelectOption key={reason} value={reason}>
              {reason}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="gap-1">
        <FieldLabel htmlFor="product-gap-filter-project">
          Filter by Project
        </FieldLabel>
        <NativeSelect
          id="product-gap-filter-project"
          onChange={(event) => set({ projectId: event.target.value })}
          value={filter.projectId}
        >
          <NativeSelectOption value="">Any Project</NativeSelectOption>
          {projects.map((project) => (
            <NativeSelectOption key={project.targetId} value={project.targetId}>
              {project.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="gap-1">
        <FieldLabel htmlFor="product-gap-status-filter">
          Filter by status
        </FieldLabel>
        <NativeSelect
          id="product-gap-status-filter"
          onChange={(event) => set({ status: event.target.value })}
          value={filter.status}
        >
          <NativeSelectOption value="">Any status</NativeSelectOption>
          {PRODUCT_GAP_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </form>
  );
}

/**
 * The exact Tool Escape events behind the number on a Gap, opened on demand
 * under the same filter. The number is a derived fact, never a decision.
 */
export function ToolEscapesPanel({
  filter,
  formatDateTime,
  loadEscapes,
  loadTargets,
  onCloseEscape,
  record,
}: {
  filter: GapFilterValues;
  formatDateTime: (value: string) => string;
  loadEscapes: LoadEscapes;
  loadTargets?: LoadProductGapTargets;
  onCloseEscape?: CloseEscape;
  record: ProductGapRecord;
}) {
  const [opened, setOpened] = useState(false);
  const escapes = useQuery({
    ...orpc.productGapEscapes.queryOptions({
      input: { ...toListFilter(filter), gapId: record.id },
    }),
    enabled: opened,
    queryFn: () => loadEscapes(record, filter),
  });
  const events = opened ? (escapes.data ?? null) : null;
  const error = escapes.isError
    ? errorText(escapes.error, `${TOOL_ESCAPE_LABEL}s could not be loaded.`)
    : undefined;

  async function open() {
    if (opened) {
      await escapes.refetch();
      return;
    }
    setOpened(true);
  }

  const label = `${record.escapeCount} ${TOOL_ESCAPE_LABEL}${record.escapeCount === 1 ? "" : "s"}`;
  return (
    <div className="space-y-2 text-sm">
      <Button
        aria-expanded={events !== null}
        aria-label={`Open ${label} of ${record.title}`}
        disabled={record.escapeCount === 0}
        onClick={() => {
          open().catch(() => undefined);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {label}
      </Button>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {events ? (
        <ul
          aria-label={`${TOOL_ESCAPE_LABEL}s of ${record.title}`}
          className="space-y-2"
        >
          {events.map((event) => (
            <li className="space-y-1 rounded-md bg-muted/40 p-3" key={event.id}>
              <p className="font-medium">
                <time dateTime={event.occurredAt}>
                  {formatDateTime(event.occurredAt)}
                </time>
                {` - ${event.tool}`}
              </p>
              <p className="whitespace-pre-wrap">{event.intendedJob}</p>
              <p>{`Reasons: ${event.reasons.join(", ")}`}</p>
              <p>
                {event.source.state === "resolved"
                  ? `Source ${event.source.targetType}: ${event.source.label ?? ""}`
                  : `Source ${event.source.targetType}: unavailable (${event.source.brokenReason ?? "No access"})`}
              </p>
              {event.note ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{`Note: ${event.note}`}</p>
              ) : null}
              {event.close ? (
                <ToolEscapeCloseEvidence
                  close={event.close}
                  formatDateTime={formatDateTime}
                />
              ) : null}
              {!event.close && onCloseEscape && loadTargets ? (
                <ToolEscapeCloseForm
                  event={event}
                  loadTargets={loadTargets}
                  onClose={async (closing, values, impact) => {
                    await onCloseEscape(closing, values, impact);
                    await open();
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
