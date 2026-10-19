import { Button } from "@cantiara/ui/components/button";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import type { EditorDocument } from "../lib/flow-editor";
import {
  type PlaceNodeDraft,
  UserFlowDetail,
  UserFlowListView,
} from "./user-flow-view";

const UserFlowCanvas = lazy(() => import("./user-flow-canvas"));

export default function UserFlowSurface({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const listOptions = orpc.userFlows.queryOptions({ input: { projectId } });
  const flows = useQuery(listOptions);
  const flowOptions = orpc.userFlow.queryOptions({
    input: selectedId ? { projectId, userFlowId: selectedId } : skipToken,
  });
  const flow = useQuery(flowOptions);
  const screens = useQuery(
    orpc.userFlowScreens.queryOptions({ input: { projectId } }),
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: orpc.userFlows.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.userFlow.key() });
  }
  async function create(title: string) {
    const created = await runOnlineOnlyWrite(() =>
      client.createUserFlow({ projectId, title }),
    );
    setSelectedId(created.id);
    await refresh();
  }
  async function saveDocument(document: EditorDocument) {
    if (!flow.data) {
      return;
    }
    try {
      await runOnlineOnlyWrite(() =>
        client.saveUserFlowVersion({
          document,
          expectedVersion: flow.data.version,
          projectId,
          userFlowId: flow.data.id,
        }),
      );
    } finally {
      await refresh();
    }
  }
  async function placeNode(draft: PlaceNodeDraft) {
    if (!flow.data) {
      return;
    }
    try {
      await runOnlineOnlyWrite(() =>
        client.placeUserFlowNode({
          expectedVersion: flow.data.version,
          kind: draft.kind,
          projectId,
          screenId: draft.screenId,
          text: draft.text,
          userFlowId: flow.data.id,
        }),
      );
    } finally {
      await refresh();
    }
  }

  function retry() {
    flows.refetch().catch(() => undefined);
  }

  if (flows.isPending) {
    return <p role="status">Loading User Flows…</p>;
  }
  if (!flows.data) {
    return (
      <div className="space-y-3">
        <p role="alert">User Flows are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <UserFlowListView
      flows={flows.data}
      onCreate={create}
      onSelect={setSelectedId}
      readOnly={false}
      selected={
        flow.data ? (
          <div className="space-y-4">
            <Suspense fallback={<p role="status">Loading canvas…</p>}>
              <UserFlowCanvas
                flow={flow.data}
                onDirtyChange={setDirty}
                onSave={saveDocument}
              />
            </Suspense>
            <UserFlowDetail
              flow={flow.data}
              onPlaceNode={placeNode}
              readOnly={dirty}
              screens={screens.data ?? []}
            />
          </div>
        ) : null
      }
      selectedId={selectedId}
    />
  );
}
