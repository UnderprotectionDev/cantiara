// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project Release.
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
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
  if (pack.isPending) {
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
          await runOnlineOnlyWrite(() =>
            client.addReleaseChecklistItem({ ...input, text }),
          );
          await refresh();
        },
        onCloseSignal: async () => {
          await runOnlineOnlyWrite(() =>
            client.closeReleaseOpenScopeSignal(input),
          );
          await refresh();
        },
        onRemoveItem: async (itemId) => {
          await runOnlineOnlyWrite(() =>
            client.removeReleaseChecklistItem({ ...input, itemId }),
          );
          await refresh();
        },
        onSetItem: async (itemId, checked) => {
          await runOnlineOnlyWrite(() =>
            client.setReleaseChecklistItem({ ...input, checked, itemId }),
          );
          await refresh();
        },
      }}
      pack={pack.data}
      projectId={projectId}
      signal={signal.data?.signal ?? null}
    />
  );
}
