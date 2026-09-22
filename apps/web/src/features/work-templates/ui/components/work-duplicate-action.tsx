// biome-ignore-all lint/performance/noJsxPropsBind: Work duplicate controls close over the selected Work and preview state.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

export default function WorkDuplicateAction({
  defaultOpen = false,
  work,
}: {
  defaultOpen?: boolean;
  work: WorkProfile;
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [selectedDefinitionIds, setSelectedDefinitionIds] = useState<string[]>(
    [],
  );
  const [createdWorkKey, setCreatedWorkKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    ...orpc.previewDuplicateWork.queryOptions({
      input: { sourceWorkId: work.id },
    }),
    enabled: open,
  });
  useEffect(() => {
    if (preview.data) {
      setSelectedDefinitionIds(
        preview.data.customFields.map((field) => field.definitionId),
      );
    }
  }, [preview.data]);

  const duplicate = useMutation({
    mutationFn: () =>
      runOnlineOnlyWrite(() =>
        client.duplicateWork({
          baseRevision: preview.data?.sourceRevision ?? work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          customFieldDefinitionIds: selectedDefinitionIds,
          sourceWorkId: work.id,
        }),
      ),
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : "Work could not be duplicated. Try again.",
      );
    },
    onSuccess: async (created) => {
      setError(null);
      setOpen(false);
      setCreatedWorkKey(created.key);
      await queryClient.invalidateQueries({
        queryKey: projectWorksQueryPrefix,
      });
    },
  });

  const pending = duplicate.isPending || preview.isPending;

  function toggleDefinition(definitionId: string, checked: boolean) {
    setSelectedDefinitionIds((current) =>
      checked
        ? [...current, definitionId]
        : current.filter((candidate) => candidate !== definitionId),
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={connection === "offline"}
        onClick={() => {
          setOpen(true);
          setCreatedWorkKey(null);
          setError(null);
        }}
        size="xs"
        type="button"
        variant="outline"
      >
        Duplicate Work
      </Button>
      {createdWorkKey ? (
        <p className="text-muted-foreground text-xs" role="status">
          Created Work {createdWorkKey}.
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      {open ? (
        <form
          aria-label="Duplicate Work"
          className="w-full space-y-3 rounded-md border border-border/70 bg-background/80 p-3 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            duplicate.mutate();
          }}
        >
          {preview.isPending ? (
            <p className="text-muted-foreground text-xs" role="status">
              Loading copy preview…
            </p>
          ) : null}
          {preview.isError ? (
            <p className="text-destructive text-xs" role="alert">
              Copy preview could not be loaded. Try again.
            </p>
          ) : null}
          {preview.data ? (
            <>
              <p className="text-muted-foreground text-xs">
                Copies title, type, description, the checklist, and the selected
                Custom fields into a new Work with a new key. History,
                relations, close outcome, current status, and dates are not
                copied.
              </p>
              <dl className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Title</dt>
                  <dd className="font-medium">{preview.data.title}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{preview.data.type}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="font-medium">
                    {preview.data.description ?? "Not set"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Checklist</dt>
                  <dd className="font-medium">
                    {preview.data.checklist.length} item
                    {preview.data.checklist.length === 1 ? "" : "s"}
                  </dd>
                </div>
              </dl>
              {preview.data.customFields.length > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="text-muted-foreground text-xs">
                    Selected field values
                  </legend>
                  {preview.data.customFields.map((field) => {
                    const checkboxId = `work-duplicate-${work.id}-${field.definitionId}`;
                    return (
                      <label
                        className="flex items-center gap-2 text-xs"
                        htmlFor={checkboxId}
                        key={field.definitionId}
                      >
                        <Checkbox
                          checked={selectedDefinitionIds.includes(
                            field.definitionId,
                          )}
                          disabled={pending}
                          id={checkboxId}
                          onCheckedChange={(checked) =>
                            toggleDefinition(
                              field.definitionId,
                              checked === true,
                            )
                          }
                        />
                        {field.name}
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
              <div className="flex gap-2">
                <Button disabled={pending} size="xs" type="submit">
                  Duplicate Work
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
