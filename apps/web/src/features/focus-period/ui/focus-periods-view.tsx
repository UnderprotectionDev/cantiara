// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.

import {
  createFocusPeriodInputSchema,
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
  type FocusPeriodLearning,
  type FocusPeriodRecord,
} from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

async function abandonSelectedWork(
  periodId: string,
  workIds: string[],
  closeAnyway: boolean,
  decide: (
    input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
  ) => Promise<unknown>,
  afterEach: (workId: string) => void,
) {
  for (const selectedWorkId of workIds) {
    // biome-ignore lint/performance/noAwaitInLoops: Each Work closure precedes its individual decision for retry safety.
    const current = await client.work({ workId: selectedWorkId });
    if (current.status !== "Closed") {
      const preview = await client.workClosePreview({ workId: selectedWorkId });
      const hasChecks =
        preview.closureCheck.activeBlockers.length > 0 ||
        preview.closureCheck.incompleteChecklistItems.length > 0;
      if (hasChecks && !closeAnyway) {
        throw new Error("Review closure checks or select Close anyway.");
      }
      await runOnlineOnlyWrite(() =>
        client.closeWork({
          workId: selectedWorkId,
          baseRevision: current.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          closureResult: "Abandoned",
          ...(closeAnyway ? { closureCheck: "Close anyway" as const } : {}),
        }),
      );
    } else if (current.closureResult !== "Abandoned") {
      throw new Error("Work was already completed.");
    }
    await decide({
      periodId,
      workIds: [selectedWorkId],
      destination: "Abandon",
    });
    afterEach(selectedWorkId);
  }
}

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
  const form = useForm({
    defaultValues: { purpose: "", startDate: "", endDate: "" },
    onSubmit: async ({ value }) => {
      const parsed = createFocusPeriodInputSchema.safeParse(value);
      if (!parsed.success) {
        setError(
          value.purpose.trim()
            ? "Focus Period must be 1–8 weeks."
            : "Purpose is required.",
        );
        return;
      }
      setError(null);
      try {
        await create.mutateAsync(parsed.data);
        form.reset();
      } catch {
        setError("Focus Period could not be created.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
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
      <section aria-label="Create Focus Period" className="space-y-4">
        <h2 className="font-semibold text-xl">Create Focus Period</h2>
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={submit}>
          <form.Field name="purpose">
            {(field) => (
              <label className="flex flex-col gap-1 text-sm">
                Purpose
                <input
                  aria-describedby={
                    error === "Purpose is required."
                      ? "focus-period-purpose-error"
                      : undefined
                  }
                  className="rounded-md border bg-background px-3 py-2"
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                {error === "Purpose is required." ? (
                  <span
                    className="text-destructive"
                    id="focus-period-purpose-error"
                  >
                    {error}
                  </span>
                ) : null}
              </label>
            )}
          </form.Field>
          <form.Field name="startDate">
            {(field) => (
              <label className="flex flex-col gap-1 text-sm">
                Start date
                <input
                  aria-describedby={
                    error === "Focus Period must be 1–8 weeks."
                      ? "focus-period-dates-error"
                      : undefined
                  }
                  className="rounded-md border bg-background px-3 py-2"
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="date"
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="endDate">
            {(field) => (
              <label className="flex flex-col gap-1 text-sm">
                End date
                <input
                  aria-describedby={
                    error === "Focus Period must be 1–8 weeks."
                      ? "focus-period-dates-error"
                      : undefined
                  }
                  className="rounded-md border bg-background px-3 py-2"
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="date"
                  value={field.state.value}
                />
                {error === "Focus Period must be 1–8 weeks." ? (
                  <span
                    className="text-destructive"
                    id="focus-period-dates-error"
                  >
                    {error}
                  </span>
                ) : null}
              </label>
            )}
          </form.Field>
          <div>
            <Button disabled={create.isPending} type="submit">
              Create Focus Period
            </Button>
          </div>
        </form>
      </section>
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

type FocusPeriodMembershipInput = Parameters<typeof client.addToFocusPeriod>[0];

interface FocusPeriodMembershipMutation {
  mutateAsync: (input: FocusPeriodMembershipInput) => Promise<unknown>;
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
  saveEvaluation: {
    mutateAsync: (
      input: Parameters<typeof client.saveFocusPeriodEvaluation>[0],
    ) => Promise<unknown>;
  };
  createFollowUp: {
    mutateAsync: (
      input: Parameters<typeof client.createFocusPeriodFollowUpWork>[0],
    ) => Promise<unknown>;
  };
  act: (
    action: () => Promise<unknown>,
    conflictMessage?: string,
  ) => Promise<void>;
}) {
  const [showCloseReview, setShowCloseReview] = useState(false);
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const [destination, setDestination] = useState<
    "Next period" | "Another period" | "Backlog" | "Abandon"
  >("Backlog");
  const [targetPeriodId, setTargetPeriodId] = useState("");
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [closeAnyway, setCloseAnyway] = useState(false);
  const open = isOpenPeriod(period);
  const stillOpen = period.members.filter((item) => item.status !== "Closed");
  const undecided = (period.closeSnapshot ?? []).filter(
    (item) =>
      item.status !== "Closed" &&
      !period.leftoverDecisions.some((decision) => decision.workId === item.id),
  );
  const targets = periods.filter(
    (item) => item.id !== period.id && isOpenPeriod(item),
  );
  async function sendDecisions() {
    if (!selectedWorkIds.length) {
      return;
    }
    if (destination === "Abandon") {
      if (!confirmAbandon) {
        throw new Error("Confirm Abandon first.");
      }
      await abandonSelectedWork(
        period.id,
        selectedWorkIds,
        closeAnyway,
        decide.mutateAsync,
        (decidedWorkId) =>
          setSelectedWorkIds((ids) => ids.filter((id) => id !== decidedWorkId)),
      );
    } else {
      for (const selectedWorkId of selectedWorkIds) {
        // biome-ignore lint/performance/noAwaitInLoops: Each selected Work is recorded independently for recoverable partial sends.
        await decide.mutateAsync({
          periodId: period.id,
          workIds: [selectedWorkId],
          destination,
          ...(destination === "Another period" ? { targetPeriodId } : {}),
        });
        setSelectedWorkIds((ids) => ids.filter((id) => id !== selectedWorkId));
      }
    }
    setSelectedWorkIds([]);
  }
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
      {period.status === "Closed" && undecided.length ? (
        <section
          aria-label="Still-open Work decisions"
          className="space-y-3 rounded-md border p-4"
        >
          <h3 className="font-semibold">Still-open Work</h3>
          <p>
            Select Work and choose where it goes. Nothing moves automatically.
          </p>
          <div className="space-y-2">
            {undecided.map((item) => (
              <label className="flex items-center gap-2" key={item.id}>
                <input
                  checked={selectedWorkIds.includes(item.id)}
                  onChange={(event) =>
                    setSelectedWorkIds((ids) =>
                      event.target.checked
                        ? [...ids, item.id]
                        : ids.filter((id) => id !== item.id),
                    )
                  }
                  type="checkbox"
                />
                {item.title} · {item.key}
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            Destination
            <select
              className="rounded-md border bg-background px-3 py-2"
              onChange={(event) =>
                setDestination(event.target.value as typeof destination)
              }
              value={destination}
            >
              <option>Next period</option>
              <option>Backlog</option>
              <option>Another period</option>
              <option>Abandon</option>
            </select>
          </label>
          {destination === "Another period" ? (
            <label className="flex flex-col gap-1">
              Another period
              <select
                className="rounded-md border bg-background px-3 py-2"
                onChange={(event) => setTargetPeriodId(event.target.value)}
                value={targetPeriodId}
              >
                <option value="">Select Focus Period</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.purpose}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {destination === "Abandon" ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  checked={confirmAbandon}
                  onChange={(event) => setConfirmAbandon(event.target.checked)}
                  type="checkbox"
                />
                Confirm Abandon selected Work
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={closeAnyway}
                  onChange={(event) => setCloseAnyway(event.target.checked)}
                  type="checkbox"
                />
                Close anyway if closure checks remain
              </label>
            </div>
          ) : null}
          <Button
            disabled={
              !selectedWorkIds.length ||
              (destination === "Another period" && !targetPeriodId) ||
              (destination === "Abandon" && !confirmAbandon)
            }
            onClick={() => act(sendDecisions)}
            type="button"
          >
            Send
          </Button>
        </section>
      ) : null}
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
      <DependenciesSection period={period} />
    </section>
  );
}

function FocusPeriodMembershipControl({
  period,
  periods,
  add,
  move,
  act,
}: {
  period: FocusPeriodRecord;
  periods: FocusPeriodRecord[];
  add: FocusPeriodMembershipMutation;
  move: FocusPeriodMembershipMutation;
  act: FocusPeriodAction;
}) {
  const [workId, setWorkId] = useState("");
  const activeSource =
    period.status === "Active" && workId
      ? periods.find(
          (item) =>
            item.id !== period.id &&
            item.status === "Active" &&
            item.members.some((member) => member.id === workId),
        )
      : undefined;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
        <label htmlFor={`focus-period-work-${period.id}`}>Select Work</label>
        <select
          className="rounded-md border bg-background px-3 py-2"
          id={`focus-period-work-${period.id}`}
          onChange={(event) => setWorkId(event.target.value)}
          value={workId}
        >
          <option value="">Select Work</option>
          {period.available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.projectName} · {item.key} · {item.title}
            </option>
          ))}
        </select>
      </div>
      <Button
        disabled={!workId}
        onClick={() =>
          act(async () => {
            const mutation = activeSource ? move : add;
            await mutation.mutateAsync({ periodId: period.id, workId });
            setWorkId("");
          })
        }
        type="button"
      >
        {activeSource ? "Move" : "Add Work"}
      </Button>
    </div>
  );
}

const EVALUATION_FIELD_BY_LEARNING = {
  Keep: "keep",
  Change: "change",
  "Try next": "tryNext",
} as const;

type FocusPeriodAction = (action: () => Promise<unknown>) => Promise<void>;

interface FocusPeriodSaveEvaluation {
  mutateAsync: (
    input: Parameters<typeof client.saveFocusPeriodEvaluation>[0],
  ) => Promise<unknown>;
}

interface FocusPeriodCreateFollowUp {
  mutateAsync: (
    input: Parameters<typeof client.createFocusPeriodFollowUpWork>[0],
  ) => Promise<unknown>;
}

interface FocusPeriodRemove {
  mutateAsync: (input: {
    periodId: string;
    workId: string;
  }) => Promise<unknown>;
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
  const totals = [
    ["In start snapshot", comparison.inStartSnapshot.length],
    ["Added later", comparison.addedLater.length],
    ["Removed", comparison.removed.length],
    ["Completed", comparison.completed.length],
    ["Still-open Work", comparison.stillOpen.length],
  ] as const;
  return (
    <section aria-label="Close comparison" className="space-y-3">
      <h3 className="font-semibold">Close comparison</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        {totals.map(([label, count]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PeriodEvaluationSection({
  period,
  saveEvaluation,
  act,
}: {
  period: FocusPeriodRecord;
  saveEvaluation: FocusPeriodSaveEvaluation;
  act: FocusPeriodAction;
}) {
  const [evaluation, setEvaluation] = useState({
    keep: period.evaluation?.keep ?? "",
    change: period.evaluation?.change ?? "",
    tryNext: period.evaluation?.tryNext ?? "",
  });
  function save(next: typeof evaluation) {
    setEvaluation(next);
    return act(() =>
      saveEvaluation.mutateAsync({ periodId: period.id, evaluation: next }),
    );
  }
  return (
    <section aria-label="Period evaluation" className="space-y-3">
      <h3 className="font-semibold">Period evaluation</h3>
      <p className="text-muted-foreground text-sm">
        Optional learning notes. Leave the fields blank to skip.
      </p>
      <label className="flex flex-col gap-1">
        Keep
        <textarea
          className="min-h-20 rounded-md border bg-background px-3 py-2"
          onChange={(event) =>
            setEvaluation((value) => ({ ...value, keep: event.target.value }))
          }
          value={evaluation.keep}
        />
      </label>
      <label className="flex flex-col gap-1">
        Change
        <textarea
          className="min-h-20 rounded-md border bg-background px-3 py-2"
          onChange={(event) =>
            setEvaluation((value) => ({ ...value, change: event.target.value }))
          }
          value={evaluation.change}
        />
      </label>
      <label className="flex flex-col gap-1">
        Try next
        <textarea
          className="min-h-20 rounded-md border bg-background px-3 py-2"
          onChange={(event) =>
            setEvaluation((value) => ({
              ...value,
              tryNext: event.target.value,
            }))
          }
          value={evaluation.tryNext}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(evaluation)} type="button">
          Save evaluation
        </Button>
        <Button
          onClick={() => save({ keep: "", change: "", tryNext: "" })}
          type="button"
          variant="outline"
        >
          Skip
        </Button>
      </div>
    </section>
  );
}

function FollowUpWorkSection({
  period,
  createFollowUp,
  act,
}: {
  period: FocusPeriodRecord;
  createFollowUp: FocusPeriodCreateFollowUp;
  act: FocusPeriodAction;
}) {
  const [learning, setLearning] = useState<FocusPeriodLearning>("Try next");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientIdempotencyKey, setClientIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [showPreview, setShowPreview] = useState(false);
  const projectsQuery = useQuery(orpc.projects.queryOptions());
  const projects = (projectsQuery.data ?? []).filter(
    (item) => item.status === "Active" || item.status === "Pending",
  );
  const learningText =
    period.evaluation?.[EVALUATION_FIELD_BY_LEARNING[learning]] ?? "";
  function editDraft(update: () => void) {
    update();
    setClientIdempotencyKey(crypto.randomUUID());
    setShowPreview(false);
  }
  async function confirm() {
    await createFollowUp.mutateAsync({
      periodId: period.id,
      learning,
      projectId,
      title,
      type: "Task",
      clientIdempotencyKey,
      ...(description.trim() ? { description } : {}),
    });
    setTitle("");
    setDescription("");
    setShowPreview(false);
    setClientIdempotencyKey(crypto.randomUUID());
  }
  return (
    <>
      <section aria-label="Add follow-up Work" className="space-y-3">
        <h3 className="font-semibold">Add follow-up Work</h3>
        <p className="text-muted-foreground text-sm">
          Review the Work and its source learning before confirming. No Work is
          created until you confirm.
        </p>
        <label className="flex flex-col gap-1">
          Learning source
          <select
            className="rounded-md border bg-background px-3 py-2"
            onChange={(event) =>
              editDraft(() =>
                setLearning(event.target.value as FocusPeriodLearning),
              )
            }
            value={learning}
          >
            <option>Keep</option>
            <option>Change</option>
            <option>Try next</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Project
          <select
            className="rounded-md border bg-background px-3 py-2"
            onChange={(event) =>
              editDraft(() => setProjectId(event.target.value))
            }
            value={projectId}
          >
            <option value="">Select Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Title
          <input
            className="rounded-md border bg-background px-3 py-2"
            maxLength={255}
            onChange={(event) => editDraft(() => setTitle(event.target.value))}
            value={title}
          />
        </label>
        <label className="flex flex-col gap-1">
          Description
          <textarea
            className="min-h-20 rounded-md border bg-background px-3 py-2"
            maxLength={100_000}
            onChange={(event) =>
              editDraft(() => setDescription(event.target.value))
            }
            value={description}
          />
        </label>
        <Button
          disabled={!(learningText.trim() && projectId && title.trim())}
          onClick={() => setShowPreview(true)}
          type="button"
          variant="outline"
        >
          Preview Follow-up Work
        </Button>
        {learningText.trim() ? null : (
          <p className="text-muted-foreground text-sm">
            Save a {learning} learning before creating Follow-up Work.
          </p>
        )}
        {showPreview ? (
          <section
            aria-label="Follow-up Work preview"
            className="space-y-3 rounded-md border p-4"
          >
            <h4 className="font-semibold">Follow-up Work preview</h4>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Title</dt>
                <dd>{title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd>
                  {projects.find((item) => item.id === projectId)?.name ?? ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Learning</dt>
                <dd>
                  {learning}: {learningText}
                </dd>
              </div>
              {description.trim() ? (
                <div>
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{description}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Source Focus Period</dt>
                <dd>{period.purpose}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act(confirm)} type="button">
                Confirm
              </Button>
              <Button
                onClick={() => setShowPreview(false)}
                type="button"
                variant="outline"
              >
                Change
              </Button>
            </div>
          </section>
        ) : null}
      </section>
      <section aria-label="Follow-up Work" className="space-y-2">
        <h3 className="font-semibold">Created Follow-up Work</h3>
        {period.followUpWorks.length ? (
          <ul className="space-y-2">
            {period.followUpWorks.map((item) => (
              <li className="rounded-md border px-3 py-2" key={item.id}>
                <Link
                  aria-label={`Open source record: ${item.key} ${item.title}`}
                  hash={workRecordHash(item.id)}
                  params={{ projectId: item.projectId }}
                  to="/projects/$projectId"
                >
                  {item.title} · {item.key} · {item.projectName}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {item.learning}: {item.learningText}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No Follow-up Work linked to this Focus Period.
          </p>
        )}
      </section>
    </>
  );
}

function DependenciesSection({ period }: { period: FocusPeriodRecord }) {
  return (
    <section aria-label="Dependencies" className="space-y-3">
      <h3 className="font-semibold">Dependencies</h3>
      {period.dependencies.edges.length ? (
        <ul className="space-y-2">
          {period.dependencies.edges.map((edge) => {
            const inCycle = period.dependencies.cycles.some((cycle) =>
              cycle.edges.some(
                ({ relationId }) => relationId === edge.relationId,
              ),
            );
            const blocker = period.members.find(
              (item) => item.id === edge.blocker.recordId,
            );
            const blocked = period.members.find(
              (item) => item.id === edge.blocked.recordId,
            );
            return (
              <li className="rounded-md border px-3 py-2" key={edge.relationId}>
                {blocker ? (
                  <Link
                    aria-label={`Open source record: ${blocker.key} ${blocker.title}`}
                    hash={workRecordHash(blocker.id)}
                    params={{ projectId: blocker.projectId }}
                    to="/projects/$projectId"
                  >
                    {blocker.title} · {blocker.key}
                  </Link>
                ) : null}
                {" blocks "}
                {blocked ? (
                  <Link
                    aria-label={`Open source record: ${blocked.key} ${blocked.title}`}
                    hash={workRecordHash(blocked.id)}
                    params={{ projectId: blocked.projectId }}
                    to="/projects/$projectId"
                  >
                    {blocked.title} · {blocked.key}
                  </Link>
                ) : null}
                <p className="text-muted-foreground text-sm">
                  {edge.status}
                  {inCycle ? " · Part of a dependency cycle" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No dependencies in this Focus Period.
        </p>
      )}
    </section>
  );
}
