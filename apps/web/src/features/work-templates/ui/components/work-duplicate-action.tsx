// biome-ignore-all lint/performance/noJsxPropsBind: Work duplicate controls close over the selected Work and preview state.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  Popover,
  type PopoverActions,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { client, orpc } from "@/utils/orpc";
import WorkDuplicateForm from "../forms/work-duplicate-form";

export default function WorkDuplicateAction({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const popup = useRef<PopoverActions | null>(null);
  const duplicate = useMutation(
    orpc.duplicateWork.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.duplicateWork(input),
      onSuccess: async (created) => {
        popup.current?.close();
        await queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.queryKey({
            input: { projectId: created.projectId },
          }),
        });
      },
    }),
  );
  const createdWorkKey =
    duplicate.variables?.sourceWorkId === work.id
      ? duplicate.data?.key
      : undefined;
  const error =
    duplicate.isError && duplicate.variables.sourceWorkId === work.id
      ? duplicate.error.message || "Work could not be duplicated. Try again."
      : null;

  return (
    <div className="flex flex-col items-start gap-2">
      <Popover
        actionsRef={popup}
        onOpenChange={(open, event) => {
          if (open) {
            duplicate.reset();
          } else if (
            duplicate.isPending &&
            event.reason !== "imperative-action"
          ) {
            event.cancel();
          }
        }}
      >
        <PopoverTrigger
          disabled={connection === "offline"}
          render={<Button size="xs" variant="outline" />}
        >
          Duplicate Work
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label="Duplicate Work"
          className="w-96 max-w-[calc(100vw-2rem)]"
        >
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DuplicatePreview duplicate={duplicate} work={work} />
        </PopoverContent>
      </Popover>
      {createdWorkKey ? (
        <p className="text-xs text-muted-foreground" role="status">
          Created Work {createdWorkKey}.
        </p>
      ) : null}
    </div>
  );
}

function DuplicatePreview({
  duplicate,
  work,
}: Pick<Parameters<typeof WorkDuplicateForm>[0], "duplicate" | "work">) {
  const preview = useQuery(
    orpc.previewDuplicateWork.queryOptions({
      input: { sourceWorkId: work.id },
    }),
  );
  return (
    <WorkDuplicateForm
      duplicate={duplicate}
      pending={duplicate.isPending || preview.isPending}
      preview={preview}
      work={work}
    />
  );
}
