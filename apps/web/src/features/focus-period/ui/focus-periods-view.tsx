// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.

import {
  createFocusPeriodInputSchema,
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
  async function act(action: () => Promise<unknown>, conflictMessage?: string) {
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
      setError(
        localMessage ??
          (mutationError instanceof Error &&
          "code" in mutationError &&
          mutationError.code === "CONFLICT" &&
          conflictMessage
            ? conflictMessage
            : "Focus Period could not be updated."),
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
              decide={decide}
              key={selected.id}
              period={selected}
              periods={periods.data}
              remove={remove}
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
  remove,
  cancel,
  close,
  decide,
  periods,
  act,
}: {
  period: FocusPeriodRecord;
  periods: FocusPeriodRecord[];
  add: {
    mutateAsync: (input: {
      periodId: string;
      workId: string;
    }) => Promise<unknown>;
  };
  remove: {
    mutateAsync: (input: {
      periodId: string;
      workId: string;
    }) => Promise<unknown>;
  };
  cancel: { mutateAsync: (periodId: string) => Promise<unknown> };
  close: { mutateAsync: (periodId: string) => Promise<unknown> };
  decide: {
    mutateAsync: (
      input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
    ) => Promise<unknown>;
  };
  act: (
    action: () => Promise<unknown>,
    conflictMessage?: string,
  ) => Promise<void>;
}) {
  const [workId, setWorkId] = useState("");
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            <label htmlFor={`focus-period-work-${period.id}`}>
              Select Work
            </label>
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
                await add.mutateAsync({ periodId: period.id, workId });
                setWorkId("");
              }, "Work is already in another Focus Period.")
            }
            type="button"
          >
            Add Work
          </Button>
        </div>
      ) : null}
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
    </section>
  );
}
