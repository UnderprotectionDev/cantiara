import type {
  ScreenLifecycleAction,
  ScreenRecord,
} from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { ScreensView } from "./screens-view";

export default function ScreensSurface({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const options = orpc.projectScreens.queryOptions({ input: { projectId } });
  const screens = useQuery(options);
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
  }
  async function create(title: string) {
    await runOnlineOnlyWrite(() => client.createScreen({ projectId, title }));
    await refresh();
  }
  async function setLifecycle(
    screen: ScreenRecord,
    action: ScreenLifecycleAction,
  ) {
    try {
      await runOnlineOnlyWrite(() =>
        client.setScreenLifecycle({
          action,
          expectedRevision: screen.revision,
          projectId,
          screenId: screen.id,
        }),
      );
    } finally {
      await refresh();
    }
  }
  function retry() {
    screens.refetch().catch(() => undefined);
  }
  if (screens.isPending) {
    return <p role="status">Loading Screens…</p>;
  }
  if (!screens.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Screens are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <ScreensView
      onCreate={create}
      onSetLifecycle={setLifecycle}
      readOnly={screens.data.readOnly}
      screens={screens.data.screens}
    />
  );
}
