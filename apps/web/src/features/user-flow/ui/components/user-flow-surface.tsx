import type {
  UserFlowRebindPlan,
  UserFlowViewport,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { client, orpc } from "@/utils/orpc";
import type { EditorDocument } from "../../lib/flow-editor";
import type { PromoteChoice } from "../forms/promote-to-screen-form";
import {
  type PlaceNodeDraft,
  UserFlowDetail,
  type UserFlowDetailTools,
  UserFlowListView,
} from "../views/user-flow-view";

const UserFlowCanvas = lazy(() => import("./user-flow-canvas"));

export default function UserFlowSurface({ projectId }: { projectId: string }) {
  const createUserFlowFromTemplateMutation = useMutation(
    orpc.createUserFlowFromTemplate.mutationOptions({
      mutationFn: (input) => client.createUserFlowFromTemplate(input),
    }),
  );
  const createUserFlowMutation = useMutation(
    orpc.createUserFlow.mutationOptions({
      mutationFn: (input) => client.createUserFlow(input),
    }),
  );
  const saveUserFlowVersionMutation = useMutation(
    orpc.saveUserFlowVersion.mutationOptions({
      mutationFn: (input) => client.saveUserFlowVersion(input),
    }),
  );
  const placeUserFlowNodeMutation = useMutation(
    orpc.placeUserFlowNode.mutationOptions({
      mutationFn: (input) => client.placeUserFlowNode(input),
    }),
  );
  const convertUserFlowNodeMutation = useMutation(
    orpc.convertUserFlowNode.mutationOptions({
      mutationFn: (input) => client.convertUserFlowNode(input),
    }),
  );
  const placeUserFlowCardMutation = useMutation(
    orpc.placeUserFlowCard.mutationOptions({
      mutationFn: (input) => client.placeUserFlowCard(input),
    }),
  );
  const promoteUserFlowNodeMutation = useMutation(
    orpc.promoteUserFlowNode.mutationOptions({
      mutationFn: (input) => client.promoteUserFlowNode(input),
    }),
  );
  const rebindUserFlowBindMutation = useMutation(
    orpc.rebindUserFlowBind.mutationOptions({
      mutationFn: (input) => client.rebindUserFlowBind(input),
    }),
  );
  const saveUserFlowTemplateMutation = useMutation(
    orpc.saveUserFlowTemplate.mutationOptions({
      mutationFn: (input) => client.saveUserFlowTemplate(input),
    }),
  );
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const listOptions = orpc.userFlows.queryOptions({ input: { projectId } });
  const flows = useQuery(listOptions);
  const flowOptions = orpc.userFlow.queryOptions({
    input: selectedId ? { projectId, userFlowId: selectedId } : skipToken,
  });
  const flow = useQuery(flowOptions);
  // The personal viewport of this canvas; the canvas opens only after it settles.
  const viewportOptions = orpc.userFlowViewport.queryOptions({
    input: selectedId ? { projectId, userFlowId: selectedId } : skipToken,
  });
  const viewport = useQuery(viewportOptions);
  const screens = useQuery(
    orpc.userFlowScreens.queryOptions({ input: { projectId } }),
  );

  const binds = useQuery(
    orpc.userFlowBinds.queryOptions({
      input: selectedId ? { projectId, userFlowId: selectedId } : skipToken,
    }),
  );
  const cardRecords = useQuery(
    orpc.userFlowCardRecords.queryOptions({ input: { projectId } }),
  );
  const templates = useQuery(
    orpc.userFlowTemplates.queryOptions({ input: { projectId } }),
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: orpc.userFlows.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.userFlow.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.userFlowBinds.key() });
    await queryClient.invalidateQueries({
      queryKey: orpc.userFlowCardRecords.key(),
    });
  }
  async function createFromTemplate(templateId: string, title: string) {
    const created = await createUserFlowFromTemplateMutation.mutateAsync({
      projectId,
      templateId,
      title,
    });
    setSelectedId(created.id);
    await refresh();
  }
  async function create(title: string) {
    const created = await createUserFlowMutation.mutateAsync({
      projectId,
      title,
    });
    setSelectedId(created.id);
    await refresh();
  }
  async function saveDocument(document: EditorDocument) {
    if (!flow.data) {
      return;
    }
    try {
      await saveUserFlowVersionMutation.mutateAsync({
        document,
        expectedVersion: flow.data.version,
        projectId,
        userFlowId: flow.data.id,
      });
    } finally {
      await refresh();
    }
  }
  // A personal working position, not content: it writes no version and is not offline-queued.
  function saveViewport(next: UserFlowViewport) {
    if (!flow.data) {
      return;
    }
    queryClient.setQueryData(viewportOptions.queryKey, next);
    client
      .saveUserFlowViewport({
        projectId,
        userFlowId: flow.data.id,
        viewport: next,
      })
      .catch(() => undefined);
  }
  async function placeNode(draft: PlaceNodeDraft) {
    if (!flow.data) {
      return;
    }
    try {
      await placeUserFlowNodeMutation.mutateAsync({
        expectedVersion: flow.data.version,
        kind: draft.kind,
        projectId,
        screenId: draft.screenId,
        text: draft.text,
        userFlowId: flow.data.id,
      });
    } finally {
      await refresh();
    }
  }

  const tools: UserFlowDetailTools | undefined = flow.data
    ? {
        binds: binds.data ?? [],
        cardRecords: cardRecords.data ?? [],
        onConvertConfirm: async (nodeId, plan, identity) => {
          try {
            return await convertUserFlowNodeMutation.mutateAsync({
              baseRevision: 0,
              clientIdempotencyKey: identity.key,
              id: identity.id,
              nodeId,
              plan,
              projectId,
              recordId: identity.recordId,
              userFlowId: flow.data.id,
            });
          } finally {
            await refresh();
          }
        },
        onConvertPreview: (nodeId, target, workType) =>
          client.previewUserFlowConvert({
            nodeId,
            projectId,
            target,
            userFlowId: flow.data.id,
            workType,
          }),
        onPlaceCard: async (kind, recordId) => {
          try {
            await placeUserFlowCardMutation.mutateAsync({
              expectedVersion: flow.data.version,
              kind,
              projectId,
              recordId,
              userFlowId: flow.data.id,
            });
          } finally {
            await refresh();
          }
        },
        onPreviewRebind: (bindId) =>
          client.previewUserFlowRebind({
            bindId,
            projectId,
            userFlowId: flow.data.id,
          }),
        onPromote: async (nodeId: string, choice: PromoteChoice) => {
          try {
            await promoteUserFlowNodeMutation.mutateAsync({
              expectedVersion: flow.data.version,
              nodeId,
              projectId,
              screen: choice,
              userFlowId: flow.data.id,
            });
          } finally {
            await refresh();
            await queryClient.invalidateQueries({
              queryKey: orpc.userFlowScreens.key(),
            });
          }
        },
        onRebind: async (bindId: string, plan: UserFlowRebindPlan) => {
          try {
            await rebindUserFlowBindMutation.mutateAsync({
              bindId,
              plan,
              projectId,
              userFlowId: flow.data.id,
            });
          } finally {
            await refresh();
          }
        },
        // Removing a live card saves this flow without it; the source record is not written.
        onRemoveCard: (cardId) =>
          saveDocument({
            cards: flow.data.cards
              .filter(({ id }) => id !== cardId)
              .map((card) => ({
                id: card.id,
                kind: card.record.kind as "Decision" | "Risk" | "Work",
                position: card.position,
                recordId: card.record.recordId,
              })),
            links: flow.data.links,
            nodes: flow.data.nodes.map((node) => ({
              id: node.id,
              kind: node.kind,
              position: node.position,
              screenId: node.screen?.screenId ?? null,
              sectionId: node.sectionId,
              style: node.style,
              text: node.text,
            })),
          }),
        onSaveTemplate: async (name, nodeIds) => {
          await saveUserFlowTemplateMutation.mutateAsync({
            name,
            nodeIds,
            projectId,
            userFlowId: flow.data.id,
          });
          await queryClient.invalidateQueries({
            queryKey: orpc.userFlowTemplates.key(),
          });
        },
      }
    : undefined;

  function retry() {
    flows.refetch().catch(() => undefined);
  }

  if (flows.status === "pending") {
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
      onCreateFromTemplate={createFromTemplate}
      onSelect={setSelectedId}
      readOnly={false}
      selected={
        flow.data && !viewport.isPending ? (
          <div className="space-y-4">
            <Suspense fallback={<p role="status">Loading canvas…</p>}>
              <UserFlowCanvas
                flow={flow.data}
                initialViewport={viewport.data ?? null}
                onDirtyChange={setDirty}
                onSave={saveDocument}
                onViewportChange={saveViewport}
                screenOptions={screens.data ?? []}
              />
            </Suspense>
            <UserFlowDetail
              flow={flow.data}
              onPlaceNode={placeNode}
              readOnly={dirty}
              screens={screens.data ?? []}
              tools={tools}
            />
          </div>
        ) : null
      }
      selectedId={selectedId}
      templates={templates.data ?? []}
    />
  );
}
