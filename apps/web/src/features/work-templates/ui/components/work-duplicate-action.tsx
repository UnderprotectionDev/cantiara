// biome-ignore-all lint/performance/noJsxPropsBind: Work duplicate controls close over the selected Work and preview state.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { client, orpc } from "@/utils/orpc";
import WorkDuplicateForm from "../forms/work-duplicate-form";

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

  const preview = useQuery({
    ...orpc.previewDuplicateWork.queryOptions({
      input: { sourceWorkId: work.id },
    }),
    enabled: open,
  });
  const duplicate = useMutation(
    orpc.duplicateWork.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.duplicateWork(input),
      onSuccess: async (created) => {
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
  const pending = duplicate.isPending || preview.isPending;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={connection === "offline"}
        onClick={() => {
          setOpen(true);
          duplicate.reset();
        }}
        size="xs"
        type="button"
        variant="outline"
      >
        Duplicate Work
      </Button>
      {createdWorkKey ? (
        <p className="text-xs text-muted-foreground" role="status">
          Created Work {createdWorkKey}.
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {open && !duplicate.isSuccess ? (
        <WorkDuplicateForm
          duplicate={duplicate}
          pending={pending}
          preview={preview}
          setOpen={setOpen}
          work={work}
        />
      ) : null}
    </div>
  );
}
