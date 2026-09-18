// biome-ignore-all lint/performance/noJsxPropsBind: Work type controls close over their current Work state.

import {
  WORK_TYPE_OPTIONS,
  type WorkProfile,
  type WorkType,
  type WorkTypeChangePreview,
} from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
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
import WorkRecreateForm from "@/features/work-lifecycle/ui/forms/work-recreate-form";
import { client, orpc } from "@/utils/orpc";

export default function ProjectWorkList({ projectId }: { projectId: string }) {
  const query = useQuery(
    orpc.projectWorks.queryOptions({
      input: { projectId },
    }),
  );

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

  if (query.data.length === 0) {
    return (
      <p className="mt-2 text-muted-foreground text-sm/relaxed">
        No sample content was created.
      </p>
    );
  }

  return (
    <ul aria-label="Work list" className="mt-4 space-y-2">
      {query.data.map((work) => (
        <li
          className="flex flex-wrap items-center justify-between gap-3 border bg-background px-3 py-3"
          key={work.id}
        >
          <div className="min-w-0">
            <p className="font-medium text-sm">
              <span className="text-muted-foreground">{work.key}</span>{" "}
              {work.title}
            </p>
            {work.recreatedFrom ? (
              <p className="mt-1 text-muted-foreground text-xs">
                Derived from {work.recreatedFrom.key}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <WorkTypeEditor work={work} />
            <Badge variant="secondary">{work.status}</Badge>
            <WorkRecreateForm work={work} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work type could not be changed. Try again.";
}

function WorkTypeEditor({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<WorkType>(work.type);
  const [preview, setPreview] = useState<WorkTypeChangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const worksQueryKey = orpc.projectWorks.queryOptions({
    input: { projectId: work.projectId },
  }).queryKey;
  const workQueryKey = orpc.work.queryOptions({
    input: { workId: work.id },
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
      setError(mutationErrorMessage(mutationError));
    },
    onSuccess: async () => {
      setError(null);
      setPreview(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: worksQueryKey }),
        queryClient.invalidateQueries({ queryKey: workQueryKey }),
      ]);
    },
  });

  const previewTypeChange = useMutation({
    mutationFn: (type: WorkType) =>
      client.workTypeChangePreview({ workId: work.id, type }),
    onError: (mutationError) => {
      setSelectedType(work.type);
      setError(mutationErrorMessage(mutationError));
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
