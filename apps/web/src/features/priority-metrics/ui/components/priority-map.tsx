// biome-ignore-all lint/performance/noJsxPropsBind: Each map card closes over its Work and selected criteria.
import {
  PRIORITY_METRIC_RANKS,
  type PriorityMetricProjectValues,
  type PriorityMetricValueListItem,
} from "@cantiara/api/priority-metrics";
import {
  buildWorkContextModel,
  type WorkContextProjection,
} from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { priorityMetricItemsForWork } from "@/features/priority-metrics/hooks/use-priority-metrics";
import PriorityMetricValuesForm from "@/features/priority-metrics/ui/components/priority-metric-values-form";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";
import { orpc } from "@/utils/orpc";

const EVIDENCE_COUNT_LABELS = [
  "Feedback",
  "Unique Contact",
  "Unique Company",
] as const;

interface EvidenceQueryResult {
  data?: WorkContextProjection;
  isError: boolean;
  isPending: boolean;
}

interface WorkPlacement {
  unevaluated: WorkProfile[];
  worksByCell: Map<string, WorkProfile[]>;
}

export default function PriorityMap({ projectId }: { projectId: string }) {
  const [horizontalMetricId, setHorizontalMetricId] = useState<string | null>(
    null,
  );
  const [verticalMetricId, setVerticalMetricId] = useState<string | null>(null);
  const [showEvidenceSignals, setShowEvidenceSignals] = useState(false);
  const workQuery = useQuery(
    orpc.projectWorks.queryOptions({
      input: { archived: false, projectId },
    }),
  );
  const valuesQuery = useQuery(
    orpc.priorityMetricProjectValues.queryOptions({
      input: { projectId },
    }),
  );
  const works = workQuery.data ?? [];
  const evidenceQueries = useQueries({
    queries: works.map((work) => ({
      ...orpc.workContext.queryOptions({ input: { workId: work.id } }),
      enabled: showEvidenceSignals,
    })),
  });
  const evidenceQueriesByWorkId = new Map<string, EvidenceQueryResult>();
  works.forEach((work, index) => {
    const query = evidenceQueries[index];
    if (query) {
      evidenceQueriesByWorkId.set(work.id, query);
    }
  });

  if (workQuery.isPending || valuesQuery.isPending) {
    return (
      <section aria-label="Priority Map" className="space-y-3">
        <h3 className="font-medium text-lg">Priority Map</h3>
        <p className="text-muted-foreground text-sm" role="status">
          Loading…
        </p>
      </section>
    );
  }

  if (workQuery.isError || valuesQuery.isError) {
    return (
      <section aria-label="Priority Map" className="space-y-3">
        <h3 className="font-medium text-lg">Priority Map</h3>
        <p className="text-destructive text-sm" role="alert">
          Priority Map is unavailable. Try loading this page again.
        </p>
      </section>
    );
  }

  const projectValues = valuesQuery.data;
  const metrics = projectValues.definitions.filter(
    (metric) => metric.enabled && metric.trashedAt === null,
  );

  if (metrics.length < 2) {
    return (
      <section aria-label="Priority Map" className="space-y-3">
        <h3 className="font-medium text-lg">Priority Map</h3>
        <p className="text-muted-foreground text-sm/relaxed">
          Enable two metrics in Configuration Mode to compare Work here.
        </p>
      </section>
    );
  }

  const [firstMetric, secondMetric] = metrics;
  if (!(firstMetric && secondMetric)) {
    return null;
  }

  const horizontalMetric =
    metrics.find((metric) => metric.id === horizontalMetricId) ?? firstMetric;
  const defaultVerticalMetric =
    secondMetric.id === horizontalMetric.id ? firstMetric : secondMetric;
  const verticalMetric =
    metrics.find(
      (metric) =>
        metric.id === verticalMetricId && metric.id !== horizontalMetric.id,
    ) ?? defaultVerticalMetric;
  const { unevaluated, worksByCell } = placeWorks(
    works,
    projectValues,
    horizontalMetric.id,
    verticalMetric.id,
  );

  const verticalRanks = [...PRIORITY_METRIC_RANKS].reverse();

  return (
    <section aria-label="Priority Map" className="space-y-5">
      <header className="max-w-3xl space-y-2">
        <h3 className="font-medium text-lg">Priority Map</h3>
        <p className="text-muted-foreground text-sm/relaxed">
          Compare Work by two Project metrics.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="priority-map-horizontal-axis">
            Horizontal axis
          </FieldLabel>
          <NativeSelect
            id="priority-map-horizontal-axis"
            onChange={(event) => setHorizontalMetricId(event.target.value)}
            value={horizontalMetric.id}
          >
            {metrics.map((metric) => (
              <NativeSelectOption
                disabled={metric.id === verticalMetric.id}
                key={metric.id}
                value={metric.id}
              >
                {metric.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="priority-map-vertical-axis">
            Vertical axis
          </FieldLabel>
          <NativeSelect
            id="priority-map-vertical-axis"
            onChange={(event) => setVerticalMetricId(event.target.value)}
            value={verticalMetric.id}
          >
            {metrics.map((metric) => (
              <NativeSelectOption
                disabled={metric.id === horizontalMetric.id}
                key={metric.id}
                value={metric.id}
              >
                {metric.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field className="flex-row items-center gap-2">
        <Checkbox
          aria-label="Show evidence signals"
          checked={showEvidenceSignals}
          id="show-evidence-signals"
          onCheckedChange={(checked) =>
            setShowEvidenceSignals(checked === true)
          }
        />
        <FieldLabel className="font-normal" htmlFor="show-evidence-signals">
          Show evidence signals
        </FieldLabel>
      </Field>

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table
          aria-label="Work by selected criteria"
          className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm"
        >
          <caption className="sr-only">Priority Map</caption>
          <thead>
            <tr>
              <th
                className="w-32 border-border/70 border-b bg-muted/30 p-3 font-medium"
                scope="col"
              >
                {verticalMetric.name}
              </th>
              {PRIORITY_METRIC_RANKS.map((rank) => (
                <th
                  className="border-border/70 border-b bg-muted/30 p-3 font-medium"
                  key={rank}
                  scope="col"
                >
                  {rank}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {verticalRanks.map((verticalRank) => (
              <tr key={verticalRank}>
                <th
                  className="border-border/70 border-b bg-muted/30 p-3 font-medium"
                  scope="row"
                >
                  {verticalRank}
                </th>
                {PRIORITY_METRIC_RANKS.map((horizontalRank) => {
                  const cellWorks =
                    worksByCell.get(`${horizontalRank}\u001f${verticalRank}`) ??
                    [];
                  return (
                    <td
                      aria-label={`${horizontalMetric.name}: ${horizontalRank}; ${verticalMetric.name}: ${verticalRank}`}
                      className="h-32 min-w-36 border-border/70 border-b border-l p-2 align-top last:border-r"
                      key={horizontalRank}
                    >
                      {cellWorks.length > 0 ? (
                        <ul className="space-y-2">
                          {cellWorks.map((work) => (
                            <li key={work.id}>
                              <PriorityMapWork
                                axisMetricIds={[
                                  horizontalMetric.id,
                                  verticalMetric.id,
                                ]}
                                context={evidenceQueriesByWorkId.get(work.id)}
                                projectId={projectId}
                                projectValues={projectValues}
                                showEvidenceSignals={showEvidenceSignals}
                                work={work}
                                works={works}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        {horizontalMetric.name} increases from left to right.{" "}
        {verticalMetric.name} increases from bottom to top.
      </p>

      <section
        aria-labelledby="priority-map-unevaluated-heading"
        className="space-y-3"
      >
        <div className="border-border/70 border-b pb-2">
          <h4
            className="font-medium text-sm"
            id="priority-map-unevaluated-heading"
          >
            Unevaluated
          </h4>
        </div>
        {unevaluated.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {works.length === 0 ? "No Work yet." : "No unevaluated Work."}
          </p>
        ) : (
          <ul aria-label="Unevaluated Work" className="space-y-2">
            {unevaluated.map((work) => (
              <li key={work.id}>
                <PriorityMapWork
                  axisMetricIds={[horizontalMetric.id, verticalMetric.id]}
                  context={evidenceQueriesByWorkId.get(work.id)}
                  projectId={projectId}
                  projectValues={projectValues}
                  showEvidenceSignals={showEvidenceSignals}
                  work={work}
                  works={works}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function placeWorks(
  works: readonly WorkProfile[],
  projectValues: PriorityMetricProjectValues,
  horizontalMetricId: string,
  verticalMetricId: string,
): WorkPlacement {
  const valuesByKey = new Map(
    projectValues.values.map((value) => [
      `${value.workId}\u001f${value.metricId}`,
      value.rank,
    ]),
  );
  const unevaluated: WorkProfile[] = [];
  const worksByCell = new Map<string, WorkProfile[]>();

  for (const work of works) {
    const horizontalRank =
      valuesByKey.get(`${work.id}\u001f${horizontalMetricId}`) ?? null;
    const verticalRank =
      valuesByKey.get(`${work.id}\u001f${verticalMetricId}`) ?? null;
    if (!(horizontalRank && verticalRank)) {
      unevaluated.push(work);
      continue;
    }
    const cellKey = `${horizontalRank}\u001f${verticalRank}`;
    const cellWorks = worksByCell.get(cellKey) ?? [];
    cellWorks.push(work);
    worksByCell.set(cellKey, cellWorks);
  }

  return { unevaluated, worksByCell };
}

function PriorityMapWork({
  axisMetricIds,
  context,
  projectId,
  projectValues,
  showEvidenceSignals,
  work,
  works,
}: {
  axisMetricIds: readonly string[];
  context: EvidenceQueryResult | undefined;
  projectId: string;
  projectValues: PriorityMetricProjectValues;
  showEvidenceSignals: boolean;
  work: WorkProfile;
  works: readonly WorkProfile[];
}) {
  const axisItems: PriorityMetricValueListItem[] = priorityMetricItemsForWork(
    projectValues,
    work.id,
  ).filter((item) => axisMetricIds.includes(item.definition.id));

  return (
    <article className="space-y-2 rounded-md border border-border/70 bg-card p-2.5">
      <a
        className="block font-medium text-sm underline-offset-4 hover:underline"
        href={workRecordHref(projectId, work.id)}
      >
        <span className="text-muted-foreground">{work.key}</span> — {work.title}
      </a>
      {showEvidenceSignals ? (
        <EvidenceSignals context={context} work={work} works={works} />
      ) : null}
      <details className="border-border/70 border-t pt-2">
        <summary
          aria-label={`Edit axis values for ${work.key}`}
          className="cursor-pointer text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          Edit axis values
        </summary>
        <PriorityMetricValuesForm
          items={axisItems}
          projectId={projectId}
          workId={work.id}
          workKey={work.key}
        />
      </details>
    </article>
  );
}

function EvidenceSignals({
  context,
  work,
  works,
}: {
  context: EvidenceQueryResult | undefined;
  work: WorkProfile;
  works: readonly WorkProfile[];
}) {
  if (context?.isError) {
    return (
      <p className="text-destructive text-xs" role="alert">
        Evidence signals could not be loaded.
      </p>
    );
  }
  if (context?.isPending || !context?.data) {
    return (
      <p className="text-muted-foreground text-xs" role="status">
        Loading…
      </p>
    );
  }

  const {
    priorityFoundations: { counts },
  } = buildWorkContextModel({
    priorityValues: context.data.priorityValues,
    projectWorks: works,
    relations: context.data.relations,
    work,
  });

  return (
    <fieldset className="flex flex-wrap gap-x-2 text-muted-foreground text-xs">
      <legend className="sr-only">Evidence signals for {work.key}</legend>
      {EVIDENCE_COUNT_LABELS.map((label) => (
        <span key={label}>
          {label}: {counts.find((count) => count.label === label)?.count ?? 0}
        </span>
      ))}
    </fieldset>
  );
}
