// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.

import type { FocusPeriodRecord } from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import {
  VirtualList,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
import { isDefinedError, ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { client, orpc } from "@/utils/orpc";
import type {
  FocusPeriodAction,
  FocusPeriodCreateFollowUp,
  FocusPeriodMembershipMutation,
  FocusPeriodRemove,
  FocusPeriodSaveEvaluation,
} from "../../lib/focus-period-actions";
import { FocusPeriodDependencies } from "../components/focus-period-dependencies";
import { CreateFocusPeriodForm } from "../forms/create-focus-period-form";
import { PeriodEvaluationSection } from "../forms/focus-period-evaluation-form";
import { FollowUpWorkSection } from "../forms/focus-period-follow-up-form";
import { PeriodLeftoverDecisions } from "../forms/focus-period-leftover-form";
import { FocusPeriodMembershipControl } from "../forms/focus-period-membership-form";

export default function FocusPeriodsView({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const periods = useQuery(orpc.focusPeriods.queryOptions());
  const [validationError, setValidationError] = useState<string | null>(null);
  const selected =
    periods.data?.find((period) => period.id === selectedId) ??
    periods.data?.[0];
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.focusPeriods.queryOptions().queryKey,
    });
  const create = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.createFocusPeriod.mutationKey(),
    mutationFn: (input: {
      purpose: string;
      startDate: string;
      endDate: string;
    }) => client.createFocusPeriod(input),
    onSuccess: async (period) => {
      onSelect(period.id);
      await refresh();
    },
  });
  const add = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.addToFocusPeriod.mutationKey(),
    mutationFn: (input: { periodId: string; workId: string }) =>
      client.addToFocusPeriod(input),
    onSuccess: refresh,
  });
  const move = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.moveToFocusPeriod.mutationKey(),
    mutationFn: (input: { periodId: string; workId: string }) =>
      client.moveToFocusPeriod(input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.removeFromFocusPeriod.mutationKey(),
    mutationFn: (input: { periodId: string; workId: string }) =>
      client.removeFromFocusPeriod(input),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.cancelFocusPeriod.mutationKey(),
    mutationFn: (periodId: string) => client.cancelFocusPeriod({ periodId }),
    onSuccess: refresh,
  });
  const close = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.closeFocusPeriod.mutationKey(),
    mutationFn: (periodId: string) => client.closeFocusPeriod({ periodId }),
    onSuccess: refresh,
  });
  const decide = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.decideFocusPeriodLeftovers.mutationKey(),
    mutationFn: (
      input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
    ) => client.decideFocusPeriodLeftovers(input),
    onSuccess: refresh,
  });
  const saveEvaluation = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.saveFocusPeriodEvaluation.mutationKey(),
    mutationFn: (
      input: Parameters<typeof client.saveFocusPeriodEvaluation>[0],
    ) => client.saveFocusPeriodEvaluation(input),
    onSuccess: refresh,
  });
  const createFollowUp = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.createFocusPeriodFollowUpWork.mutationKey(),
    mutationFn: (
      input: Parameters<typeof client.createFocusPeriodFollowUpWork>[0],
    ) => client.createFocusPeriodFollowUpWork(input),
    onSuccess: refresh,
  });
  const [latest] = [
    create,
    add,
    move,
    remove,
    cancel,
    close,
    decide,
    saveEvaluation,
    createFollowUp,
  ].sort((left, right) => right.submittedAt - left.submittedAt);
  const error =
    validationError ?? focusPeriodWriteError(latest?.error, latest === create);
  async function act(action: () => Promise<unknown>) {
    setValidationError(null);
    try {
      await action();
    } catch (failure) {
      if (
        failure instanceof Error &&
        [
          "Confirm Abandon first.",
          "Review closure checks or select Close anyway.",
          "Work was already completed.",
        ].includes(failure.message)
      ) {
        setValidationError(failure.message);
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-9 sm:px-8">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold">Focus Period</h1>
        <p className="mt-2 text-muted-foreground">
          Choose Work from any Project for a 1–8 week window.
        </p>
      </header>
      <CreateFocusPeriodForm
        error={error}
        isPending={create.isPending}
        onCreate={(input) => create.mutateAsync(input)}
        onError={setValidationError}
      />
      {error &&
      error !== "Purpose is required." &&
      error !== "Focus Period must be 1–8 weeks." ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {periods.status === "pending" ? (
        <p role="status">Loading Focus Period…</p>
      ) : null}
      {periods.isError ? (
        <p role="alert">Focus Period is unavailable.</p>
      ) : null}
      {periods.data?.length === 0 ? <p>No Focus Period yet.</p> : null}
      {periods.data?.length ? (
        <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Focus Period" className="space-y-2">
            <VirtualList
              as="div"
              estimateSize={44}
              gap={8}
              getKey={virtualRowId}
              rows={periods.data}
            >
              {(period, rowProps) => (
                <button
                  aria-current={selected?.id === period.id ? "page" : undefined}
                  className="block w-full rounded-md border px-3 py-2 text-left hover:bg-muted"
                  {...rowProps}
                  onClick={() => onSelect(period.id)}
                  type="button"
                >
                  <span className="block font-medium">{period.purpose}</span>
                  <span className="text-sm text-muted-foreground">
                    {period.startDate} – {period.endDate} · {period.status}
                  </span>
                </button>
              )}
            </VirtualList>
          </nav>
          {selected ? (
            <PeriodDetail
              act={act}
              add={add}
              cancel={cancel}
              close={close}
              createFollowUp={createFollowUp}
              decide={decide}
              key={selected.id}
              move={move}
              period={selected}
              periods={periods.data}
              remove={remove}
              saveEvaluation={saveEvaluation}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function focusPeriodWriteError(error: unknown, creating: boolean) {
  if (!error) {
    return null;
  }
  if (
    error instanceof ORPCError &&
    isDefinedError(error) &&
    (error.code === "FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT" ||
      error.code === "FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT")
  ) {
    return error.message;
  }
  return creating
    ? "Focus Period could not be created."
    : "Focus Period could not be updated.";
}

function isOpenPeriod(period: FocusPeriodRecord) {
  return period.status === "Planned" || period.status === "Active";
}

function PeriodDetail({
  period,
  add,
  move,
  remove,
  cancel,
  close,
  decide,
  saveEvaluation,
  createFollowUp,
  periods,
  act,
}: {
  period: FocusPeriodRecord;
  periods: FocusPeriodRecord[];
  add: FocusPeriodMembershipMutation;
  move: FocusPeriodMembershipMutation;
  remove: FocusPeriodMembershipMutation;
  cancel: { mutateAsync: (periodId: string) => Promise<unknown> };
  close: { mutateAsync: (periodId: string) => Promise<unknown> };
  decide: {
    mutateAsync: (
      input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
    ) => Promise<unknown>;
  };
  saveEvaluation: FocusPeriodSaveEvaluation;
  createFollowUp: FocusPeriodCreateFollowUp;
  act: (
    action: () => Promise<unknown>,
    conflictMessage?: string,
  ) => Promise<void>;
}) {
  const open = isOpenPeriod(period);
  const stillOpen = period.members.filter((item) => item.status !== "Closed");
  const unavailableWorkIds = new Set(
    period.closeComparison?.stillOpen
      .filter((item) => item.sourceAvailable === false)
      .map((item) => item.id),
  );
  const undecided = (period.closeSnapshot ?? []).filter(
    (item) =>
      item.status !== "Closed" &&
      !unavailableWorkIds.has(item.id) &&
      !period.leftoverDecisions.some((decision) => decision.workId === item.id),
  );
  const targets = periods.filter(
    (item) => item.id !== period.id && isOpenPeriod(item),
  );
  return (
    <Collapsible
      aria-label={period.purpose}
      className="space-y-5"
      render={<section />}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{period.purpose}</h2>
          <p>
            {period.startDate} – {period.endDate} · {period.status}
          </p>
        </div>
        <div className="flex gap-2">
          {period.status === "Active" ? (
            <CollapsibleTrigger render={<Button />}>Close</CollapsibleTrigger>
          ) : null}
          {open ? (
            <Button
              onClick={() => act(() => cancel.mutateAsync(period.id))}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      {period.status === "Active" ? (
        <CollapsibleContent
          aria-label="Still-open Work"
          className="space-y-3 rounded-md border p-4"
          render={<section />}
        >
          <h3 className="font-semibold">Still-open Work</h3>
          {stillOpen.length ? (
            <VirtualList
              className="list-inside list-disc"
              estimateSize={80}
              gap={8}
              getKey={virtualRowId}
              rows={stillOpen}
            >
              {(item, rowProps) => (
                <li {...rowProps}>
                  {item.title} · {item.key}
                </li>
              )}
            </VirtualList>
          ) : (
            <p>No Work remains open.</p>
          )}
          <p className="text-sm text-muted-foreground">
            Closing keeps this Work open. No Work moves to another Focus Period
            automatically.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => act(() => close.mutateAsync(period.id))}
              type="button"
            >
              Close
            </Button>
            <CollapsibleTrigger render={<Button variant="outline" />}>
              Keep period open
            </CollapsibleTrigger>
          </div>
        </CollapsibleContent>
      ) : null}
      <PeriodLeftoverDecisions
        act={act}
        decide={decide}
        period={period}
        targets={targets}
        undecided={undecided}
      />
      {open ? (
        <FocusPeriodMembershipControl
          act={act}
          add={add}
          move={move}
          period={period}
          periods={periods}
        />
      ) : null}
      <WorkMembersSection
        act={act}
        open={open}
        period={period}
        remove={remove}
      />
      {period.startSnapshot ? (
        <p className="text-sm text-muted-foreground">
          In start snapshot: {period.startSnapshot.length}
        </p>
      ) : null}
      {period.closeSnapshot ? (
        <section>
          <h3 className="font-semibold">Still-open Work</h3>
          <VirtualList
            className="mt-2 space-y-1"
            estimateSize={50}
            gap={8}
            getKey={virtualRowId}
            rows={period.closeSnapshot.filter(
              (item) => item.status !== "Closed",
            )}
          >
            {(item, rowProps) => (
              <li {...rowProps}>
                {item.title} · {item.key}
                {unavailableWorkIds.has(item.id) ? (
                  <p className="text-sm text-muted-foreground">
                    Work is unavailable.
                  </p>
                ) : null}
              </li>
            )}
          </VirtualList>
        </section>
      ) : null}
      <CloseComparisonSection period={period} />
      {period.status === "Closed" ? (
        <>
          <PeriodEvaluationSection
            act={act}
            period={period}
            saveEvaluation={saveEvaluation}
          />
          <FollowUpWorkSection
            act={act}
            createFollowUp={createFollowUp}
            period={period}
          />
        </>
      ) : null}
      <FocusPeriodDependencies dependencies={period.dependencies} />
    </Collapsible>
  );
}

function WorkMembersSection({
  period,
  open,
  remove,
  act,
}: {
  period: FocusPeriodRecord;
  open: boolean;
  remove: FocusPeriodRemove;
  act: FocusPeriodAction;
}) {
  return (
    <section aria-label="Work">
      <h3 className="font-semibold">Work</h3>
      {period.members.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          No Work in this Focus Period.
        </p>
      ) : (
        <VirtualList
          className="mt-2 space-y-2"
          estimateSize={90}
          gap={8}
          getKey={virtualRowId}
          rows={period.members}
        >
          {(item, rowProps) => (
            <li
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              {...rowProps}
            >
              <Link
                hash={workRecordHash(item.id)}
                params={{ projectId: item.projectId }}
                to="/projects/$projectId"
              >
                {item.title} · {item.key} · {item.projectName} · {item.status}
              </Link>
              {open ? (
                <Button
                  onClick={() =>
                    act(() =>
                      remove.mutateAsync({
                        periodId: period.id,
                        workId: item.id,
                      }),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
              ) : null}
            </li>
          )}
        </VirtualList>
      )}
    </section>
  );
}

function CloseComparisonSection({ period }: { period: FocusPeriodRecord }) {
  const comparison = period.closeComparison;
  if (!comparison) {
    return null;
  }
  const groups = [
    ["In start snapshot", comparison.inStartSnapshot],
    ["Added later", comparison.addedLater],
    ["Removed", comparison.removed],
    ["Completed", comparison.completed],
    ["Still-open Work", comparison.stillOpen],
  ] as const;
  return (
    <section aria-label="Close comparison" className="space-y-3">
      <h3 className="font-semibold">Close comparison</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map(([label, items]) => (
          <div className="min-w-0 space-y-2" key={label}>
            <dl>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{items.length}</dd>
            </dl>
            {items.length ? (
              <VirtualList
                aria-label={label}
                className="space-y-1"
                estimateSize={68}
                gap={8}
                getKey={virtualRowId}
                rows={items}
              >
                {(item, rowProps) => (
                  <li className="break-words" {...rowProps}>
                    {item.sourceAvailable === false ? (
                      <>
                        <span>
                          {item.title} · {item.key} · {item.status}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          Work is unavailable.
                        </p>
                      </>
                    ) : (
                      <Link
                        aria-label={`Open source record: ${item.key} ${item.title}`}
                        className="underline underline-offset-2"
                        hash={workRecordHash(item.id)}
                        params={{ projectId: item.projectId }}
                        to="/projects/$projectId"
                      >
                        {item.title} · {item.key} · {item.status}
                      </Link>
                    )}
                  </li>
                )}
              </VirtualList>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
