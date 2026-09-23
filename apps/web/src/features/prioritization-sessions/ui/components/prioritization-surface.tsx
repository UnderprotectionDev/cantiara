// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over the current Project and its explicit view-local order.
import type { PrioritizationSession } from "@cantiara/api/prioritization-sessions";
import type { PriorityMetricProjectValues } from "@cantiara/api/priority-metrics";
import {
  buildWorkContextModel,
  sourcesForWorkContextSection,
  type WorkContextProjection,
} from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueries } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { usePriorityMetricProjectValues } from "@/features/priority-metrics/hooks/use-priority-metrics";
import { orpc } from "@/utils/orpc";
import { usePrioritizationSessions } from "../../hooks/use-prioritization-sessions";
import { moveWorkInOrder, workPosition } from "../../lib/session-order";

export default function PrioritizationSurface({
  projectId,
}: {
  projectId: string;
}) {
  const {
    allWorkQuery,
    backlogQuery,
    closeSession,
    createSession,
    restoreSession,
    sessionQuery,
    trashSession,
    updateBacklogOrder,
    updateSessionOrder,
  } = usePrioritizationSessions(projectId);
  const [sessionName, setSessionName] = useState("");
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const priorityValues = usePriorityMetricProjectValues(projectId).query;

  const activeWorks = useMemo(
    () => (allWorkQuery.data ?? []).filter((work) => work.archivedAt === null),
    [allWorkQuery.data],
  );
  const workById = useMemo(
    () => new Map((allWorkQuery.data ?? []).map((work) => [work.id, work])),
    [allWorkQuery.data],
  );
  const orderedBacklogIds = useMemo(() => {
    const activeIds = new Set(activeWorks.map((work) => work.id));
    const savedIds = (backlogQuery.data?.workIds ?? []).filter((id) =>
      activeIds.has(id),
    );
    const savedSet = new Set(savedIds);
    return [
      ...savedIds,
      ...activeWorks.map((work) => work.id).filter((id) => !savedSet.has(id)),
    ];
  }, [activeWorks, backlogQuery.data?.workIds]);
  const activeSessions = (sessionQuery.data ?? []).filter(
    (session) => session.trashedAt === null,
  );
  const trashedSessions = (sessionQuery.data ?? []).filter(
    (session) => session.trashedAt !== null,
  );
  const scopedWorkIds = useMemo(
    () => [...new Set(activeSessions.flatMap((session) => session.workIds))],
    [activeSessions],
  );
  const workContextQueries = useQueries({
    queries: scopedWorkIds.map((workId) =>
      orpc.workContext.queryOptions({ input: { workId } }),
    ),
  });
  const workContextById = useMemo(
    () =>
      new Map(
        scopedWorkIds.map((workId, index) => [
          workId,
          workContextQueries[index],
        ]),
      ),
    [scopedWorkIds, workContextQueries],
  );

  const busy =
    createSession.isPending ||
    updateSessionOrder.isPending ||
    updateBacklogOrder.isPending ||
    closeSession.isPending ||
    trashSession.isPending ||
    restoreSession.isPending;
  const pageError =
    allWorkQuery.isError ||
    backlogQuery.isError ||
    sessionQuery.isError ||
    priorityValues.isError;

  function createPrioritizationSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = new Set(selectedWorkIds);
    createSession.mutate(
      {
        name: sessionName,
        workIds: activeWorks
          .filter((work) => selected.has(work.id))
          .map((work) => work.id),
      },
      {
        onSuccess: () => {
          setSessionName("");
          setSelectedWorkIds([]);
        },
      },
    );
  }

  function moveBacklogWork(workId: string, offset: -1 | 1) {
    const next = moveWorkInOrder(orderedBacklogIds, workId, offset);
    if (next.some((id, index) => id !== orderedBacklogIds[index])) {
      updateBacklogOrder.mutate(next);
    }
  }

  return (
    <section
      aria-labelledby="prioritization-surface-heading"
      className="mt-8 space-y-6 border-border/70 border-t pt-6"
      id="prioritization"
    >
      <header>
        <p className="surface-kicker">Project planning</p>
        <h3
          className="mt-1 font-semibold text-xl tracking-tight"
          id="prioritization-surface-heading"
        >
          Prioritization
        </h3>
        <p className="mt-2 max-w-3xl text-muted-foreground text-sm/relaxed">
          Compare a session’s own order with the Project Backlog. Each order is
          saved separately, and Work fields stay live.
        </p>
      </header>

      {pageError ? (
        <p className="text-destructive text-sm" role="alert">
          Prioritization is unavailable. Try loading this page again.
        </p>
      ) : null}
      {allWorkQuery.isPending ||
      backlogQuery.isPending ||
      sessionQuery.isPending ||
      priorityValues.isPending ? (
        <p className="text-muted-foreground text-sm">Loading Prioritization…</p>
      ) : null}

      {pageError ||
      allWorkQuery.isPending ||
      backlogQuery.isPending ||
      sessionQuery.isPending ||
      priorityValues.isPending ? null : (
        <>
          <BacklogOrderSection
            busy={busy}
            onMove={moveBacklogWork}
            orderIds={orderedBacklogIds}
            priorityValues={priorityValues.data}
            worksById={workById}
          />

          <section
            aria-labelledby="prioritization-sessions-heading"
            className="space-y-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-border/70 border-b pb-3">
              <div>
                <p className="surface-kicker">Project decision views</p>
                <h4
                  className="mt-1 font-medium text-base"
                  id="prioritization-sessions-heading"
                >
                  Prioritization Sessions
                </h4>
              </div>
              <span className="text-muted-foreground text-xs">
                {activeSessions.length} open or closed
              </span>
            </div>

            <form
              className="space-y-3 rounded-lg border border-border/70 bg-card/40 p-4"
              onSubmit={createPrioritizationSession}
            >
              <label
                className="block space-y-1.5 text-sm"
                htmlFor="session-name"
              >
                <span>Session name</span>
                <Input
                  id="session-name"
                  maxLength={200}
                  onChange={(event) =>
                    setSessionName(event.currentTarget.value)
                  }
                  placeholder="For example, Q4 launch review"
                  required
                  value={sessionName}
                />
              </label>
              <fieldset className="space-y-2">
                <legend className="font-medium text-sm">Work scope</legend>
                {activeWorks.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No active Work is available to select.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {activeWorks.map((work) => (
                      <li key={work.id}>
                        <label className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                          <input
                            checked={selectedWorkIds.includes(work.id)}
                            className="mt-0.5 accent-primary"
                            onChange={(event) => {
                              const isSelected = event.currentTarget.checked;
                              setSelectedWorkIds((current) =>
                                isSelected
                                  ? [...current, work.id]
                                  : current.filter((id) => id !== work.id),
                              );
                            }}
                            type="checkbox"
                          />
                          <span>
                            <span className="text-muted-foreground">
                              {work.key}
                            </span>{" "}
                            {work.title}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
              <Button disabled={busy || !sessionName.trim()} type="submit">
                Create Prioritization Session
              </Button>
            </form>

            {activeSessions.length === 0 ? (
              <p className="rounded-md border border-border/70 border-dashed px-4 py-5 text-muted-foreground text-sm">
                No Prioritization Sessions yet.
              </p>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <PrioritizationSessionCard
                    backlogOrder={orderedBacklogIds}
                    busy={busy}
                    key={session.id}
                    onAddWork={(workId) =>
                      updateSessionOrder.mutate({
                        session,
                        workIds: [...session.workIds, workId],
                      })
                    }
                    onClose={() => closeSession.mutate(session)}
                    onRemoveWork={(workId) =>
                      updateSessionOrder.mutate({
                        session,
                        workIds: session.workIds.filter((id) => id !== workId),
                      })
                    }
                    onReorder={(workIds) =>
                      updateSessionOrder.mutate({ session, workIds })
                    }
                    onTrash={() => trashSession.mutate(session)}
                    priorityValues={priorityValues.data}
                    session={session}
                    workContextById={workContextById}
                    works={activeWorks}
                    worksById={workById}
                  />
                ))}
              </div>
            )}

            {trashedSessions.length > 0 ? (
              <section
                aria-labelledby="prioritization-trash-heading"
                className="space-y-3 rounded-lg border border-border/70 p-4"
              >
                <h5
                  className="font-medium text-sm"
                  id="prioritization-trash-heading"
                >
                  Trash
                </h5>
                <ul className="space-y-2">
                  {trashedSessions.map((session) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 text-sm"
                      key={session.id}
                    >
                      <span>
                        {session.name} · Trashed {formatDate(session.trashedAt)}
                      </span>
                      <Button
                        disabled={busy}
                        onClick={() => restoreSession.mutate(session)}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        </>
      )}

      {createSession.isError ||
      updateSessionOrder.isError ||
      updateBacklogOrder.isError ||
      closeSession.isError ||
      trashSession.isError ||
      restoreSession.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {mutationErrorMessage(
            createSession.error ??
              updateSessionOrder.error ??
              updateBacklogOrder.error ??
              closeSession.error ??
              trashSession.error ??
              restoreSession.error,
            "The Prioritization change could not be saved.",
          )}
        </p>
      ) : null}
    </section>
  );
}

function BacklogOrderSection({
  busy,
  onMove,
  orderIds,
  priorityValues,
  worksById,
}: {
  busy: boolean;
  onMove: (workId: string, offset: -1 | 1) => void;
  orderIds: readonly string[];
  priorityValues: PriorityMetricProjectValues | undefined;
  worksById: ReadonlyMap<string, WorkProfile>;
}) {
  return (
    <section aria-labelledby="backlog-order-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-border/70 border-b pb-3">
        <div>
          <p className="surface-kicker">Project order</p>
          <h4 className="mt-1 font-medium text-base" id="backlog-order-heading">
            Backlog order
          </h4>
        </div>
        <p className="text-muted-foreground text-xs">
          This order is separate from every session.
        </p>
      </div>
      {orderIds.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No active Work in Backlog.
        </p>
      ) : (
        <ol aria-label="Backlog order" className="space-y-2">
          {orderIds.map((workId, index) => {
            const work = worksById.get(workId);
            if (!work) {
              return null;
            }
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card/30 px-3 py-2.5"
                key={workId}
              >
                <p className="min-w-0 text-sm">
                  <span className="mr-2 text-muted-foreground tabular-nums">
                    {index + 1}.
                  </span>
                  <span className="text-muted-foreground">{work.key}</span>{" "}
                  {work.title}
                </p>
                <ul
                  aria-label={`${work.key} priority metrics`}
                  className="flex min-w-full flex-wrap gap-2 text-xs sm:min-w-0 sm:flex-1"
                >
                  {(priorityValues?.definitions ?? [])
                    .filter(
                      (definition) =>
                        definition.enabled && !definition.trashedAt,
                    )
                    .map((definition) => (
                      <li
                        className="rounded-md bg-muted/60 px-2 py-1"
                        key={definition.id}
                      >
                        <span className="text-muted-foreground">
                          {definition.name}:
                        </span>{" "}
                        {priorityValues?.values.find(
                          (value) =>
                            value.metricId === definition.id &&
                            value.workId === work.id,
                        )?.rank ?? "Unevaluated"}
                      </li>
                    ))}
                </ul>
                <div className="flex gap-1">
                  <Button
                    disabled={busy || index === 0}
                    onClick={() => onMove(workId, -1)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Move up
                  </Button>
                  <Button
                    disabled={busy || index === orderIds.length - 1}
                    onClick={() => onMove(workId, 1)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Move down
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function PrioritizationSessionCard({
  backlogOrder,
  busy,
  onAddWork,
  onClose,
  onRemoveWork,
  onReorder,
  onTrash,
  priorityValues,
  session,
  works,
  worksById,
  workContextById,
}: {
  backlogOrder: readonly string[];
  busy: boolean;
  onAddWork: (workId: string) => void;
  onClose: () => void;
  onRemoveWork: (workId: string) => void;
  onReorder: (workIds: string[]) => void;
  onTrash: () => void;
  priorityValues: PriorityMetricProjectValues | undefined;
  session: PrioritizationSession;
  works: readonly WorkProfile[];
  worksById: ReadonlyMap<string, WorkProfile>;
  workContextById: ReadonlyMap<string, UseQueryResult<WorkContextProjection>>;
}) {
  const [workToAdd, setWorkToAdd] = useState("");
  const isClosed = session.closedAt !== null;
  const included = new Set(session.workIds);
  const addableWorks = works.filter((work) => !included.has(work.id));

  return (
    <article
      aria-labelledby={`session-${session.id}-heading`}
      className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h5
            className="font-medium text-base"
            id={`session-${session.id}-heading`}
          >
            {session.name}
          </h5>
          <p className="mt-1 text-muted-foreground text-xs">
            Created {formatDate(session.createdAt)}
            {isClosed ? ` · Closed ${formatDate(session.closedAt)}` : " · Open"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isClosed ? null : (
            <Button
              disabled={busy}
              onClick={onClose}
              size="xs"
              type="button"
              variant="outline"
            >
              Close session
            </Button>
          )}
          <Button
            disabled={busy}
            onClick={onTrash}
            size="xs"
            type="button"
            variant="outline"
          >
            Trash
          </Button>
        </div>
      </header>

      {isClosed ? null : (
        <div className="flex flex-wrap items-end gap-2 border-border/70 border-t pt-3">
          <label
            className="grid min-w-52 gap-1 text-xs"
            htmlFor={`add-work-${session.id}`}
          >
            <span>Work to add</span>
            <NativeSelect
              id={`add-work-${session.id}`}
              onChange={(event) => setWorkToAdd(event.currentTarget.value)}
              size="sm"
              value={workToAdd}
            >
              <NativeSelectOption value="">Select Work</NativeSelectOption>
              {addableWorks.map((work) => (
                <NativeSelectOption key={work.id} value={work.id}>
                  {work.key} {work.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button
            disabled={busy || !workToAdd}
            onClick={() => {
              onAddWork(workToAdd);
              setWorkToAdd("");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Add Work
          </Button>
        </div>
      )}

      {session.workIds.length === 0 ? (
        <p className="rounded-md border border-border/70 border-dashed px-3 py-4 text-muted-foreground text-sm">
          No Work in this session.
        </p>
      ) : (
        <ol
          aria-label={`${session.name} Session order`}
          className="space-y-3 border-border/70 border-t pt-3"
        >
          {session.workIds.map((workId, index) => (
            <PrioritizationSessionWork
              backlogOrder={backlogOrder}
              busy={busy}
              index={index}
              isClosed={isClosed}
              key={workId}
              onRemoveWork={onRemoveWork}
              onReorder={onReorder}
              priorityValues={priorityValues}
              session={session}
              work={worksById.get(workId)}
              workContextQuery={workContextById.get(workId)}
              workId={workId}
            />
          ))}
        </ol>
      )}

      {isClosed ? (
        <p className="text-muted-foreground text-xs">
          This session is read-only. Create a new Prioritization Session to make
          another order.
        </p>
      ) : null}
    </article>
  );
}

function PrioritizationSessionWork({
  backlogOrder,
  busy,
  index,
  isClosed,
  onRemoveWork,
  onReorder,
  priorityValues,
  session,
  work,
  workContextQuery,
  workId,
}: {
  backlogOrder: readonly string[];
  busy: boolean;
  index: number;
  isClosed: boolean;
  onRemoveWork: (workId: string) => void;
  onReorder: (workIds: string[]) => void;
  priorityValues: PriorityMetricProjectValues | undefined;
  session: PrioritizationSession;
  work: WorkProfile | undefined;
  workContextQuery: UseQueryResult<WorkContextProjection> | undefined;
  workId: string;
}) {
  if (!work) {
    return (
      <li className="rounded-md border border-border/70 px-3 py-3 text-muted-foreground text-sm">
        Work {workId} is unavailable and remains in the saved session scope.
      </li>
    );
  }

  const contextModel = workContextQuery?.data
    ? buildWorkContextModel({
        priorityValues: workContextQuery.data.priorityValues,
        relations: workContextQuery.data.relations,
        work,
      })
    : null;
  const riskCount =
    contextModel?.priorityFoundations.counts.find(
      (count) => count.label === "Risk",
    )?.count ?? 0;
  const evidenceCount = contextModel
    ? sourcesForWorkContextSection("Evidence", contextModel.sources).length
    : 0;
  const metricValues = (priorityValues?.definitions ?? [])
    .filter((definition) => definition.enabled && !definition.trashedAt)
    .map((definition) => ({
      name: definition.name,
      rank:
        priorityValues?.values.find(
          (value) =>
            value.metricId === definition.id && value.workId === work.id,
        )?.rank ?? "Unevaluated",
    }));
  const backlogPosition = workPosition(backlogOrder, workId);
  const isContextError = workContextQuery?.isError ?? false;
  const isContextPending = !workContextQuery || workContextQuery.isPending;

  return (
    <li className="grid gap-3 rounded-md border border-border/70 bg-background/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-medium text-sm">
          <span className="text-muted-foreground">{work.key}</span> {work.title}
          {work.archivedAt ? (
            <span className="ml-2 font-normal text-muted-foreground">
              Archived
            </span>
          ) : null}
        </p>
        {isClosed ? null : (
          <div className="flex flex-wrap gap-1">
            <Button
              aria-label={`Move ${work.key} up`}
              disabled={busy || index === 0}
              onClick={() =>
                onReorder(moveWorkInOrder(session.workIds, workId, -1))
              }
              size="xs"
              type="button"
              variant="outline"
            >
              Move up
            </Button>
            <Button
              aria-label={`Move ${work.key} down`}
              disabled={busy || index === session.workIds.length - 1}
              onClick={() =>
                onReorder(moveWorkInOrder(session.workIds, workId, 1))
              }
              size="xs"
              type="button"
              variant="outline"
            >
              Move down
            </Button>
            <Button
              aria-label={`Remove ${work.key} from session`}
              disabled={busy}
              onClick={() => onRemoveWork(workId)}
              size="xs"
              type="button"
              variant="ghost"
            >
              Remove from session
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 text-xs sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="space-y-2">
          <ul
            aria-label={`${work.key} priority metrics`}
            className="flex flex-wrap gap-2"
          >
            {metricValues.length === 0 ? (
              <li className="text-muted-foreground">
                No active priority metrics.
              </li>
            ) : (
              metricValues.map((metric) => (
                <li
                  className="rounded-md bg-muted/60 px-2 py-1"
                  key={metric.name}
                >
                  <span className="text-muted-foreground">{metric.name}:</span>{" "}
                  {metric.rank}
                </li>
              ))
            )}
          </ul>
          <p className="text-muted-foreground">
            Target date: {work.targetDate ?? "Not set"}
          </p>
          {isContextError ? (
            <p className="text-destructive" role="alert">
              Risk and Evidence counts are unavailable.
            </p>
          ) : null}
          {!isContextError && isContextPending ? (
            <p className="text-muted-foreground">Loading live Work context…</p>
          ) : null}
          {isContextError || isContextPending ? null : (
            <p className="text-muted-foreground">
              Risk: {riskCount} · Evidence: {evidenceCount}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-border/60 p-2">
          <div>
            <dt className="text-muted-foreground">Session order</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{index + 1}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Backlog order</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {backlogPosition ?? "Not in Backlog"}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Not set";
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
