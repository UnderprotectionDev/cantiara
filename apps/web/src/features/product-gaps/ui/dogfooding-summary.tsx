// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the filter and the selected Gap.
import {
  PRODUCT_GAP_STATUSES,
  type ProductGapLinkTarget,
  type ProductGapRecord,
  TOOL_ESCAPE_LABEL,
  TOOL_ESCAPE_REASONS,
  type ToolEscapeRecord,
} from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useEffect, useState } from "react";
import { errorText, type GapFilterValues } from "../lib/product-gap-form";
import type { LoadProductGapTargets } from "./product-gap-links-field";
import {
  type CloseEscape,
  ToolEscapeCloseEvidence,
  ToolEscapeCloseForm,
} from "./tool-escape-close";

export type LoadEscapes = (
  gap: ProductGapRecord,
  filter: GapFilterValues,
) => Promise<ToolEscapeRecord[]>;

/**
 * Dogfooding summary filters. They only select Gaps (and the events counted
 * under them); the list keeps the order of recording.
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
  const [projects, setProjects] = useState<ProductGapLinkTarget[]>([]);
  useEffect(() => {
    let current = true;
    loadTargets("Project")
      .then((loaded) => {
        if (current) {
          setProjects(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [loadTargets]);
  const set = (patch: Partial<GapFilterValues>) =>
    onChange({ ...filter, ...patch });
  return (
    <form
      aria-label="Filter Product Gaps"
      className="grid gap-3 rounded-lg border border-border/70 p-4 text-sm sm:grid-cols-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid gap-1">
        <label htmlFor="product-gap-filter-tool">Filter by external tool</label>
        <NativeSelect
          id="product-gap-filter-tool"
          onChange={(event) => set({ tool: event.target.value })}
          value={filter.tool}
        >
          <option value="">Any tool</option>
          {tools.map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <label htmlFor="product-gap-filter-reason">Filter by reason</label>
        <NativeSelect
          id="product-gap-filter-reason"
          onChange={(event) => set({ reason: event.target.value })}
          value={filter.reason}
        >
          <option value="">Any reason</option>
          {TOOL_ESCAPE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <label htmlFor="product-gap-filter-project">Filter by Project</label>
        <NativeSelect
          id="product-gap-filter-project"
          onChange={(event) => set({ projectId: event.target.value })}
          value={filter.projectId}
        >
          <option value="">Any Project</option>
          {projects.map((project) => (
            <option key={project.targetId} value={project.targetId}>
              {project.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <label htmlFor="product-gap-status-filter">Filter by status</label>
        <NativeSelect
          id="product-gap-status-filter"
          onChange={(event) => set({ status: event.target.value })}
          value={filter.status}
        >
          <option value="">Any status</option>
          {PRODUCT_GAP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </NativeSelect>
      </div>
    </form>
  );
}

/**
 * The exact Tool Escape events behind the number on a Gap, opened on demand
 * under the same filter. The number is a derived fact, never a decision.
 */
export function ToolEscapesPanel({
  filter,
  loadEscapes,
  loadTargets,
  onCloseEscape,
  record,
}: {
  filter: GapFilterValues;
  loadEscapes: LoadEscapes;
  loadTargets?: LoadProductGapTargets;
  onCloseEscape?: CloseEscape;
  record: ProductGapRecord;
}) {
  const [events, setEvents] = useState<ToolEscapeRecord[] | null>(null);
  const [error, setError] = useState<string>();

  async function open() {
    setError(undefined);
    try {
      setEvents(await loadEscapes(record, filter));
    } catch (caught) {
      setError(errorText(caught, `${TOOL_ESCAPE_LABEL}s could not be loaded.`));
    }
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
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {events ? (
        <ul
          aria-label={`${TOOL_ESCAPE_LABEL}s of ${record.title}`}
          className="space-y-2"
        >
          {events.map((event) => (
            <li className="space-y-1 rounded-md bg-muted/40 p-3" key={event.id}>
              <p className="font-medium">
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString()}
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
                <ToolEscapeCloseEvidence close={event.close} />
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
