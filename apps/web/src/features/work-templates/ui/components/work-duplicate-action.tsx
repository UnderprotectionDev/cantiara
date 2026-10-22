// biome-ignore-all lint/performance/noJsxPropsBind: Work duplicate controls close over the selected Work and preview state.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { DuplicateWorkInput } from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
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
  const [createdWorkKey, setCreatedWorkKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    ...orpc.previewDuplicateWork.queryOptions({
      input: { sourceWorkId: work.id },
    }),
    enabled: open,
  });
  const duplicate = useMutation({
    mutationFn: (input: DuplicateWorkInput) =>
      runOnlineOnlyWrite(() => client.duplicateWork(input)),
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
        <WorkDuplicateForm
          duplicate={duplicate}
          pending={pending}
          preview={preview}
          setError={setError}
          setOpen={setOpen}
          work={work}
        />
      ) : null}
    </div>
  );
}
