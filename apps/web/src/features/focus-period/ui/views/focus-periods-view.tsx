// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.

import {
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
  type FocusPeriodRecord,
} from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
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

export default function FocusPeriodsView() {
  const queryClient = useQueryClient();
  const periods = useQuery(orpc.focusPeriods.queryOptions());
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    periods.data?.find((period) => period.id === selectedId) ??
    periods.data?.[0];
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.focusPeriods.queryOptions().queryKey,
    });
  const create = useMutation({
    mutationFn: (input: {
      purpose: string;
      startDate: string;
      endDate: string;
    }) => runOnlineOnlyWrite(() => client.createFocusPeriod(input)),
    onSuccess: async (period) => {
      setSelectedId(period.id);
      await refresh();
    },
  });
  const add = useMutation({
    mutationFn: (input: { periodId: string; workId: string }) =>
      runOnlineOnlyWrite(() => client.addToFocusPeriod(input)),
    onSuccess: refresh,
  });
  const move = useMutation({
    mutationFn: (input: { periodId: string; workId: string }) =>
      runOnlineOnlyWrite(() => client.moveToFocusPeriod(input)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (input: { periodId: string; workId: string }) =>
      runOnlineOnlyWrite(() => client.removeFromFocusPeriod(input)),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (periodId: string) =>
      runOnlineOnlyWrite(() => client.cancelFocusPeriod({ periodId })),
    onSuccess: refresh,
  });
  const close = useMutation({
    mutationFn: (periodId: string) =>
      runOnlineOnlyWrite(() => client.closeFocusPeriod({ periodId })),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: (
      input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
    ) => runOnlineOnlyWrite(() => client.decideFocusPeriodLeftovers(input)),
    onSuccess: refresh,
  });
  const saveEvaluation = useMutation({
    mutationFn: (
      input: Parameters<typeof client.saveFocusPeriodEvaluation>[0],
    ) => runOnlineOnlyWrite(() => client.saveFocusPeriodEvaluation(input)),
    onSuccess: refresh,
  });
  const createFollowUp = useMutation({
    mutationFn: (
      input: Parameters<typeof client.createFocusPeriodFollowUpWork>[0],
    ) => runOnlineOnlyWrite(() => client.createFocusPeriodFollowUpWork(input)),
    onSuccess: refresh,
  });
  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (mutationError) {
      const localMessage =
        mutationError instanceof Error &&
        [
          "Confirm Abandon first.",
          "Review closure checks or select Close anyway.",
          "Work was already completed.",
        ].includes(mutationError.message)
          ? mutationError.message
          : null;
      const membershipConflictMessage =
        mutationError instanceof Error &&
        "code" in mutationError &&
        mutationError.code === "CONFLICT" &&
        [
          FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
          FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
        ].includes(mutationError.message)
          ? mutationError.message
          : null;
      setError(
        localMessage ??
          membershipConflictMessage ??
          "Focus Period could not be updated.",
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-9 sm:px-8">
      <header className="border-b pb-6">
        <h1 className="font-semibold text-3xl">Focus Period</h1>
        <p className="mt-2 text-muted-foreground">
          Choose Work from any Project for a 1–8 week window.
        </p>
      </header>
      <CreateFocusPeriodForm
        error={error}
        isPending={create.isPending}
        onCreate={(input) => create.mutateAsync(input)}
        onError={setError}
      />
      {error &&
      error !== "Purpose is required." &&
      error !== "Focus Period must be 1–8 weeks." ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {periods.isPending ? <p role="status">Loading Focus Period…</p> : null}
      {periods.isError ? (
        <p role="alert">Focus Period is unavailable.</p>
      ) : null}
      {periods.data?.length === 0 ? <p>No Focus Period yet.</p> : null}
      {periods.data?.length ? (
        <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Focus Period" className="space-y-2">
            {periods.data.map((period) => (
              <button
                aria-current={selected?.id === period.id ? "page" : undefined}
                className="block w-full rounded-md border px-3 py-2 text-left hover:bg-muted"
                key={period.id}
                onClick={() => setSelectedId(period.id)}
                type="button"
              >
                <span className="block font-medium">{period.purpose}</span>
                <span className="text-muted-foreground text-sm">
                  {period.startDate} – {period.endDate} · {period.status}
                </span>
              </button>
            ))}
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
  const [showCloseReview, setShowCloseReview] = useState(false);
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
    <section aria-label={period.purpose} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">{period.purpose}</h2>
          <p>
            {period.startDate} – {period.endDate} · {period.status}
          </p>
        </div>
        <div className="flex gap-2">
          {period.status === "Active" ? (
            <Button onClick={() => setShowCloseReview(true)} type="button">
              Close
            </Button>
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
      {showCloseReview && period.status === "Active" ? (
        <section
          aria-label="Still-open Work"
          className="space-y-3 rounded-md border p-4"
        >
          <h3 className="font-semibold">Still-open Work</h3>
          {stillOpen.length ? (
            <ul className="list-inside list-disc">
              {stillOpen.map((item) => (
                <li key={item.id}>
                  {item.title} · {item.key}
                </li>
              ))}
            </ul>
          ) : (
            <p>No Work remains open.</p>
          )}
          <p className="text-muted-foreground text-sm">
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
            <Button
              onClick={() => setShowCloseReview(false)}
              type="button"
              variant="outline"
            >
              Keep period open
            </Button>
          </div>
        </section>
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
        <p className="text-muted-foreground text-sm">
          In start snapshot: {period.startSnapshot.length}
        </p>
      ) : null}
      {period.closeSnapshot ? (
        <section>
          <h3 className="font-semibold">Still-open Work</h3>
          <ul className="mt-2 space-y-1">
            {period.closeSnapshot
              .filter((item) => item.status !== "Closed")
              .map((item) => (
                <li key={item.id}>
                  {item.title} · {item.key}
                  {unavailableWorkIds.has(item.id) ? (
                    <p className="text-muted-foreground text-sm">
                      Work is unavailable.
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
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
    </section>
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
        <ul className="mt-2 space-y-2">
          {period.members.map((item) => (
            <li
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              key={item.id}
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
          ))}
        </ul>
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
              <ul aria-label={label} className="space-y-1">
                {items.map((item) => (
                  <li className="break-words" key={item.id}>
                    {item.sourceAvailable === false ? (
                      <>
                        <span>
                          {item.title} · {item.key} · {item.status}
                        </span>
                        <p className="text-muted-foreground text-sm">
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
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
