// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project Release.
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";
import { ReleaseEvidencePackView } from "../views/release-evidence-pack-view";

/** Loads the Release Evidence Pack of one Project Release. Read-only. */
export default function ReleaseEvidencePackSurface({
  projectId,
  releaseId,
}: {
  projectId: string;
  releaseId: string;
}) {
  const addReleaseChecklistItemMutation = useMutation(
    orpc.addReleaseChecklistItem.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (command) => client.addReleaseChecklistItem(command),
      onSuccess: () => refresh(),
    }),
  );
  const closeReleaseOpenScopeSignalMutation = useMutation(
    orpc.closeReleaseOpenScopeSignal.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (command) => client.closeReleaseOpenScopeSignal(command),
      onSuccess: () => refresh(),
    }),
  );
  const removeReleaseChecklistItemMutation = useMutation(
    orpc.removeReleaseChecklistItem.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (command) => client.removeReleaseChecklistItem(command),
      onSuccess: () => refresh(),
    }),
  );
  const setReleaseChecklistItemMutation = useMutation(
    orpc.setReleaseChecklistItem.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (command) => client.setReleaseChecklistItem(command),
      onSuccess: () => refresh(),
    }),
  );
  const queryClient = useQueryClient();
  const input = { projectId, releaseId };
  const packOptions = orpc.projectReleaseEvidencePack.queryOptions({ input });
  const signalOptions = orpc.projectReleaseOpenScopeSignal.queryOptions({
    input,
  });
  const pack = useQuery(packOptions);
  const signal = useQuery(signalOptions);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: packOptions.queryKey }),
      queryClient.invalidateQueries({ queryKey: signalOptions.queryKey }),
    ]);
  };
  if (pack.status === "pending") {
    return <p role="status">Loading Release Evidence Pack…</p>;
  }
  if (!pack.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Release Evidence Pack is unavailable.</p>
        <Button onClick={() => pack.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <ReleaseEvidencePackView
      actions={{
        onAddItem: async (text) => {
          await addReleaseChecklistItemMutation.mutateAsync({ ...input, text });
        },
        onCloseSignal: async () => {
          await closeReleaseOpenScopeSignalMutation.mutateAsync(input);
        },
        onRemoveItem: async (itemId) => {
          await removeReleaseChecklistItemMutation.mutateAsync({
            ...input,
            itemId,
          });
        },
        onSetItem: async (itemId, checked) => {
          await setReleaseChecklistItemMutation.mutateAsync({
            ...input,
            checked,
            itemId,
          });
        },
      }}
      pack={pack.data}
      projectId={projectId}
      signal={signal.data?.signal ?? null}
    />
  );
}
