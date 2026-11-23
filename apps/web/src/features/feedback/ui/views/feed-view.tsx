// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected row and filter.

import { FEEDBACK_STATUSES, type FeedbackStatus } from "@cantiara/api/feedback";
import {
  FEED_ROW_KINDS,
  FEED_SORT_OPTIONS,
  type FeedRow,
  type FeedRowKind,
  type FeedSort,
} from "@cantiara/api/feedback-feed";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";

import { masterRecordElementId } from "../../lib/master-record-element-id";

export interface FeedQuery {
  sort: FeedSort;
  sourceType?: FeedRowKind;
  status?: FeedbackStatus;
}

/** Moves to the same master record element; the Feed copies nothing and changes no route. */
export function openMasterRecord(row: Pick<FeedRow, "id" | "kind">) {
  const element = document.getElementById(masterRecordElementId(row));
  if (!element) {
    return;
  }
  element.scrollIntoView({ block: "start" });
  element.focus();
}

function FeedFilters({
  onChange,
  query,
}: {
  onChange: (query: FeedQuery) => void;
  query: FeedQuery;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <label htmlFor="feed-source-type">Source type</label>
        <NativeSelect
          id="feed-source-type"
          onChange={(event) =>
            onChange({
              ...query,
              sourceType: (event.target.value || undefined) as
                | FeedRowKind
                | undefined,
            })
          }
          value={query.sourceType ?? ""}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          {FEED_ROW_KINDS.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {kind}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="feed-status">Status</label>
        <NativeSelect
          id="feed-status"
          onChange={(event) =>
            onChange({
              ...query,
              status: (event.target.value || undefined) as
                | FeedbackStatus
                | undefined,
            })
          }
          value={query.status ?? ""}
        >
          <NativeSelectOption value="">Any</NativeSelectOption>
          {FEEDBACK_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="feed-sort">Sort</label>
        <NativeSelect
          id="feed-sort"
          onChange={(event) =>
            onChange({ ...query, sort: event.target.value as FeedSort })
          }
          value={query.sort}
        >
          {FEED_SORT_OPTIONS.map((sort) => (
            <NativeSelectOption key={sort} value={sort}>
              {sort}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function FeedItem({
  onOpen,
  row,
  rowProps,
}: {
  onOpen: (row: FeedRow) => void;
  row: FeedRow;
  rowProps?: VirtualRowProps;
}) {
  return (
    <li
      {...rowProps}
      className="space-y-2 rounded-lg border border-border/70 p-3"
      data-record-id={row.id}
      data-record-kind={row.kind}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{row.title}</h4>
        <Button
          aria-label={`Open Source Record: ${row.title}`}
          onClick={() => onOpen(row)}
          size="sm"
          type="button"
          variant="outline"
        >
          Open Source Record
        </Button>
      </div>
      <p className="line-clamp-4 text-sm whitespace-pre-wrap">{row.body}</p>
      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-2">
          <dt>Type</dt>
          <dd>{row.kind}</dd>
        </div>
        {row.identity ? (
          <div className="flex gap-2">
            <dt>{row.kind === "Feedback" ? "Channel" : "Provider"}</dt>
            <dd>{row.identity}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt>Time</dt>
          <dd>
            <time dateTime={row.occurredAt}>{row.occurredAt}</time>
          </dd>
        </div>
        {row.status ? (
          <div className="flex gap-2">
            <dt>Status</dt>
            <dd>{row.status}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt>Project</dt>
          <dd>{row.projectId}</dd>
        </div>
        {row.attachments.length > 0 ? (
          <div className="flex gap-2">
            <dt>Attachments</dt>
            <dd>{row.attachments.map(({ name }) => name).join(", ")}</dd>
          </div>
        ) : null}
        {row.related.length > 0 ? (
          <div className="flex gap-2">
            <dt>Related</dt>
            <dd>
              {row.related
                .map(({ title, type }) => `${type}: ${title}`)
                .join("; ")}
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

/**
 * Dense read-only `Feed` of the same Feedback and long-body Source master
 * records. A row is a projection: it offers `Open Source Record` and filters,
 * and nothing that edits a status, a priority or a social reaction.
 */
export function FeedView({
  onChangeQuery,
  onOpen = openMasterRecord,
  query,
  rows,
}: {
  onChangeQuery: (query: FeedQuery) => void;
  onOpen?: (row: FeedRow) => void;
  query: FeedQuery;
  rows: FeedRow[];
}) {
  return (
    <section aria-labelledby="feed-heading" className="space-y-4">
      <h2 className="text-lg font-semibold" id="feed-heading">
        Feed
      </h2>
      <FeedFilters onChange={onChangeQuery} query={query} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to read yet.</p>
      ) : (
        <VirtualList
          aria-label="Feed"
          className="space-y-2"
          estimateSize={140}
          gap={8}
          getKey={(row) => `${row.kind}:${row.id}`}
          rows={rows}
        >
          {(row, rowProps) => (
            <FeedItem onOpen={onOpen} row={row} rowProps={rowProps} />
          )}
        </VirtualList>
      )}
    </section>
  );
}
