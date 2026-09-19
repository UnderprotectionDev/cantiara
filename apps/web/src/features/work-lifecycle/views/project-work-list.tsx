// biome-ignore-all lint/performance/noJsxPropsBind: Work type controls close over their current Work state.

import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import {
  WORK_TYPE_OPTIONS,
  type WorkMergeResult,
  type WorkProfile,
  type WorkType,
  type WorkTypeChangePreview,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  runOnlineOnlyWrite,
  useClientShellConnection,
} from "@/features/web-macos-client/views/client-shell";
import { client, orpc } from "@/utils/orpc";
import WorkMergeForm from "../ui/forms/work-merge-form";
import WorkRecreateForm from "../ui/forms/work-recreate-form";
import WorkStatusForm from "../ui/forms/work-status-form";

export default function ProjectWorkList({
  projectId,
  workStatusLabels,
}: {
  projectId: string;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [lastMergeResult, setLastMergeResult] =
    useState<WorkMergeResult | null>(null);
  const [mergeUndoError, setMergeUndoError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.projectWorks.queryOptions({
      input: { archived: showArchived, projectId },
    }),
  );
  const undoMerge = useMutation({
    mutationFn: async () => {
      if (!lastMergeResult) {
        throw new Error("This Work merge is no longer available for Undo.");
      }
      const currentWork = await client.work({
        workId: lastMergeResult.work.id,
      });
      return runOnlineOnlyWrite(() =>
        client.undoWorkMerge({
          baseRevision: currentWork.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          mergeId: lastMergeResult.mergeId,
          survivingWorkId: lastMergeResult.work.id,
        }),
      );
    },
    onError: (error) => {
      setMergeUndoError(
        mutationErrorMessage(error, "Work merge could not be undone."),
      );
    },
    onSuccess: async () => {
      setMergeUndoError(null);
      setLastMergeResult(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.queryOptions({
            input: { archived: false, projectId },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.queryOptions({
            input: { archived: true, projectId },
          }).queryKey,
        }),
      ]);
    },
  });

  if (query.isPending) {
    return <p className="mt-2 text-muted-foreground text-sm">Loading Work…</p>;
  }

  if (query.isError) {
    return (
      <p className="mt-2 text-destructive text-sm" role="alert">
        Work is unavailable. Try loading this page again.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <Button
        aria-pressed={showArchived}
        onClick={() => setShowArchived((current) => !current)}
        size="sm"
        type="button"
        variant={showArchived ? "secondary" : "outline"}
      >
        Archived
      </Button>
      {lastMergeResult ? (
        <div className="flex flex-wrap items-center gap-2 border-primary border-l-2 pl-3 text-muted-foreground text-sm">
          <p role="status">
            Origin: {lastMergeResult.retiredIdentity.key} →{" "}
            {lastMergeResult.work.key}
          </p>
          <Button
            disabled={undoMerge.isPending}
            onClick={() => undoMerge.mutate()}
            size="xs"
            type="button"
            variant="outline"
          >
            Undo
          </Button>
          {mergeUndoError ? (
            <p className="text-destructive text-xs" role="alert">
              {mergeUndoError}
            </p>
          ) : null}
        </div>
      ) : null}
      {query.data.length === 0 ? (
        <p className="text-muted-foreground text-sm/relaxed">
          {showArchived ? "No archived Work." : "No Work yet."}
        </p>
      ) : (
        <ul aria-label={showArchived ? "Archived Work list" : "Work list"}>
          {query.data.map((work) => (
            <li
              className="mb-2 flex flex-wrap items-center justify-between gap-3 border bg-background px-3 py-3 last:mb-0"
              id={`work-${work.id}`}
              key={work.id}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  <span className="text-muted-foreground">{work.key}</span>{" "}
                  {work.title}
                </p>
                {work.recreatedFrom ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    Origin: {work.recreatedFrom.key}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <WorkTypeEditor work={work} />
                <WorkStatusForm
                  work={work}
                  workStatusLabels={workStatusLabels}
                />
                <WorkArchiveAction work={work} />
                <WorkMergeForm
                  candidates={query.data.filter(
                    (candidate) => candidate.id !== work.id,
                  )}
                  onMerged={setLastMergeResult}
                  work={work}
                />
                <WorkRecreateForm work={work} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function WorkArchiveAction({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const isArchived = work.archivedAt !== null;
  const mutation = useMutation({
    mutationFn: () =>
      runOnlineOnlyWrite(() =>
        isArchived
          ? client.unarchiveWork({
              baseRevision: work.revision,
              clientIdempotencyKey: crypto.randomUUID(),
              workId: work.id,
            })
          : client.archiveWork({
              baseRevision: work.revision,
              clientIdempotencyKey: crypto.randomUUID(),
              workId: work.id,
            }),
      ),
    onError: (mutationError) => {
      setError(
        mutationErrorMessage(
          mutationError,
          isArchived
            ? "Work could not be unarchived. Try again."
            : "Work could not be archived. Try again.",
        ),
      );
    },
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.queryOptions({
            input: { archived: false, projectId: work.projectId },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.queryOptions({
            input: { archived: true, projectId: work.projectId },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.work.queryOptions({
            input: { workId: work.id },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.scopeTree.queryOptions({
            input: { projectId: work.projectId },
          }).queryKey,
        }),
      ]);
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={connection === "offline" || mutation.isPending}
        onClick={() => mutation.mutate()}
        size="xs"
        type="button"
        variant="outline"
      >
        {isArchived ? "Unarchive" : "Archive"}
      </Button>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function WorkTypeEditor({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<WorkType>(work.type);
  const [preview, setPreview] = useState<WorkTypeChangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const worksQueryKey = orpc.projectWorks.queryOptions({
    input: {
      archived: work.archivedAt !== null,
      projectId: work.projectId,
    },
  }).queryKey;
  const workQueryKey = orpc.work.queryOptions({
    input: { workId: work.id },
  }).queryKey;
  const scopeTreeQueryKey = orpc.scopeTree.queryOptions({
    input: { projectId: work.projectId },
  }).queryKey;

  useEffect(() => {
    setSelectedType(work.type);
    setPreview(null);
  }, [work.type]);

  const updateType = useMutation({
    mutationFn: (input: Parameters<typeof client.updateWorkType>[0]) =>
      runOnlineOnlyWrite(() => client.updateWorkType(input)),
    onError: (mutationError) => {
      setSelectedType(work.type);
      setError(
        mutationErrorMessage(
          mutationError,
          "Work type could not be changed. Try again.",
        ),
      );
    },
    onSuccess: async () => {
      setError(null);
      setPreview(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: worksQueryKey }),
        queryClient.invalidateQueries({ queryKey: workQueryKey }),
        queryClient.invalidateQueries({ queryKey: scopeTreeQueryKey }),
      ]);
    },
  });

  const previewTypeChange = useMutation({
    mutationFn: (type: WorkType) =>
      client.workTypeChangePreview({ workId: work.id, type }),
    onError: (mutationError) => {
      setSelectedType(work.type);
      setError(
        mutationErrorMessage(
          mutationError,
          "Work type could not be changed. Try again.",
        ),
      );
    },
    onSuccess: (nextPreview) => {
      setError(null);
      if (!nextPreview.requiresImpactPreview) {
        updateType.mutate({
          baseRevision: work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          impactPreviewId: nextPreview.previewId,
          type: nextPreview.nextType,
          workId: work.id,
        });
        return;
      }
      setPreview(nextPreview);
    },
  });

  function handleTypeChange(nextType: WorkType) {
    setSelectedType(nextType);
    setError(null);
    if (nextType === work.type) {
      setPreview(null);
      return;
    }
    previewTypeChange.mutate(nextType);
  }

  function confirmTypeChange() {
    if (!preview) {
      return;
    }
    updateType.mutate({
      baseRevision: work.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      impactPreviewId: preview.previewId,
      type: preview.nextType,
      workId: work.id,
    });
  }

  const isPending = previewTypeChange.isPending || updateType.isPending;

  return (
    <div className="flex flex-col items-end gap-2">
      <NativeSelect
        aria-label={`Type for ${work.key}`}
        disabled={connection === "offline" || isPending}
        onChange={(event) => handleTypeChange(event.target.value as WorkType)}
        value={selectedType}
      >
        {WORK_TYPE_OPTIONS.map((type) => (
          <NativeSelectOption key={type} value={type}>
            {type}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div
          aria-label="Impact preview"
          className="w-full space-y-2 border bg-muted/20 p-3 text-left text-xs"
          role="status"
        >
          <p className="font-medium text-sm">Impact preview</p>
          <p>
            Current type: {preview.currentType}. New type: {preview.nextType}.
          </p>
          <p className="text-muted-foreground">
            Changing to or from Feature requires confirmation.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={updateType.isPending}
              onClick={confirmTypeChange}
              size="xs"
              type="button"
            >
              Confirm type change
            </Button>
            <Button
              disabled={updateType.isPending}
              onClick={() => {
                setSelectedType(work.type);
                setPreview(null);
              }}
              size="xs"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
