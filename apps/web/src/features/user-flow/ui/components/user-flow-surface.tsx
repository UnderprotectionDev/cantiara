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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { lazy, Suspense, useCallback } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
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

function useSelectedUserFlow() {
  const selectedId = useSearch({
    from: "/_auth/projects/$projectId/",
    select: (search) => search.flow ?? null,
  });
  const navigate = useNavigate();
  function setSelectedId(value: string) {
    navigate({
      hash: true,
      search: (current) => ({ ...current, flow: value || undefined }),
      to: ".",
    }).catch(() => undefined);
  }
  return { selectedId, setSelectedId };
}

export default function UserFlowSurface({ projectId }: { projectId: string }) {
  const createUserFlowFromTemplateMutation = useMutation(
    orpc.createUserFlowFromTemplate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createUserFlowFromTemplate(input),
      onSuccess: async (created, { projectId: affectedProject }) => {
        setSelectedId(created.id);
        await refresh(affectedProject, created.id);
      },
    }),
  );
  const createUserFlowMutation = useMutation(
    orpc.createUserFlow.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createUserFlow(input),
      onSuccess: async (created, { projectId: affectedProject }) => {
        setSelectedId(created.id);
        await refresh(affectedProject, created.id);
      },
    }),
  );
  const saveViewportMutation = useMutation(
    orpc.saveUserFlowViewport.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.saveUserFlowViewport(input),
    }),
  );
  const saveUserFlowVersionMutation = useMutation(
    orpc.saveUserFlowVersion.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.saveUserFlowVersion(input),
      onSettled: (_, _error, { projectId: affectedProject, userFlowId }) =>
        refresh(affectedProject, userFlowId),
    }),
  );
  const placeUserFlowNodeMutation = useMutation(
    orpc.placeUserFlowNode.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.placeUserFlowNode(input),
      onSettled: (_, _error, { projectId: affectedProject, userFlowId }) =>
        refresh(affectedProject, userFlowId),
    }),
  );
  const convertUserFlowNodeMutation = useMutation(
    orpc.convertUserFlowNode.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.convertUserFlowNode(input),
      onSettled: (_, _error, { projectId: affectedProject, userFlowId }) =>
        refresh(affectedProject, userFlowId),
    }),
  );
  const placeUserFlowCardMutation = useMutation(
    orpc.placeUserFlowCard.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.placeUserFlowCard(input),
      onSettled: (_, _error, { projectId: affectedProject, userFlowId }) =>
        refresh(affectedProject, userFlowId),
    }),
  );
  const promoteUserFlowNodeMutation = useMutation(
    orpc.promoteUserFlowNode.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.promoteUserFlowNode(input),
      onSettled: (_, _error, { projectId: affectedProject, userFlowId }) =>
        Promise.all([
          refresh(affectedProject, userFlowId),
          queryClient.invalidateQueries({
            queryKey: orpc.userFlowScreens.key({
              input: { projectId: affectedProject },
            }),
          }),
        ]),
    }),
  );
  const rebindUserFlowBindMutation = useMutation(
    orpc.rebindUserFlowBind.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.rebindUserFlowBind(input),
      onSettled: (_, _error, { projectId: affectedProject, userFlowId }) =>
        refresh(affectedProject, userFlowId),
    }),
  );
  const saveUserFlowTemplateMutation = useMutation(
    orpc.saveUserFlowTemplate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.saveUserFlowTemplate(input),
      onSuccess: (_, { projectId: affectedProject }) =>
        queryClient.invalidateQueries({
          queryKey: orpc.userFlowTemplates.key({
            input: { projectId: affectedProject },
          }),
        }),
    }),
  );
  const queryClient = useQueryClient();
  const { selectedId, setSelectedId } = useSelectedUserFlow();
  const dirtyFlow = useCreateStore<string | null>(null);
  const dirty = useSelector(
    dirtyFlow,
    (id) => id !== null && id === selectedId,
  );
  const setDirty = useCallback(
    (value: boolean) => {
      dirtyFlow.setState(() => (value ? selectedId : null));
    },
    [dirtyFlow, selectedId],
  );
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

  async function refresh(affectedProject: string, userFlowId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.userFlows.key({ input: { projectId: affectedProject } }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.userFlow.key({
          input: { projectId: affectedProject, userFlowId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.userFlowBinds.key({
          input: { projectId: affectedProject, userFlowId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.userFlowCardRecords.key({
          input: { projectId: affectedProject },
        }),
      }),
    ]);
  }
  async function createFromTemplate(templateId: string, title: string) {
    await createUserFlowFromTemplateMutation.mutateAsync({
      projectId,
      templateId,
      title,
    });
  }
  async function create(title: string) {
    await createUserFlowMutation.mutateAsync({
      projectId,
      title,
    });
  }
  async function saveDocument(document: EditorDocument) {
    if (!flow.data) {
      return;
    }
    await saveUserFlowVersionMutation.mutateAsync({
      document,
      expectedVersion: flow.data.version,
      projectId,
      userFlowId: flow.data.id,
    });
  }
  // A personal working position, not content: it writes no version and is not offline-queued.
  function saveViewport(next: UserFlowViewport) {
    if (!flow.data) {
      return;
    }
    queryClient.setQueryData(viewportOptions.queryKey, next);
    saveViewportMutation.mutate({
      projectId,
      userFlowId: flow.data.id,
      viewport: next,
    });
  }
  async function placeNode(draft: PlaceNodeDraft) {
    if (!flow.data) {
      return;
    }
    await placeUserFlowNodeMutation.mutateAsync({
      expectedVersion: flow.data.version,
      kind: draft.kind,
      projectId,
      screenId: draft.screenId,
      text: draft.text,
      userFlowId: flow.data.id,
    });
  }

  const tools: UserFlowDetailTools | undefined = flow.data
    ? {
        binds: binds.data ?? [],
        cardRecords: cardRecords.data ?? [],
        convertWrite: convertUserFlowNodeMutation.variables
          ? {
              nodeId: convertUserFlowNodeMutation.variables.nodeId,
              error: convertUserFlowNodeMutation.error,
              isPending: convertUserFlowNodeMutation.isPending,
              isSuccess: convertUserFlowNodeMutation.isSuccess,
            }
          : undefined,
        rebindWrite: rebindUserFlowBindMutation.variables
          ? {
              bindId: rebindUserFlowBindMutation.variables.bindId,
              error: rebindUserFlowBindMutation.error,
              isPending: rebindUserFlowBindMutation.isPending,
              isSuccess: rebindUserFlowBindMutation.isSuccess,
            }
          : undefined,
        resetConvert: convertUserFlowNodeMutation.reset,
        resetRebind: rebindUserFlowBindMutation.reset,
        onConvertConfirm: async (nodeId, plan, identity) =>
          await convertUserFlowNodeMutation.mutateAsync({
            baseRevision: 0,
            clientIdempotencyKey: identity.key,
            id: identity.id,
            nodeId,
            plan,
            projectId,
            recordId: identity.recordId,
            userFlowId: flow.data.id,
          }),
        onConvertPreview: (nodeId, target, workType) =>
          fetchFresh(queryClient, {
            ...orpc.previewUserFlowConvert.queryOptions({
              input: {
                nodeId,
                projectId,
                target,
                userFlowId: flow.data.id,
                workType,
              },
            }),
            gcTime: 0,
          }),
        onPlaceCard: async (kind, recordId) => {
          await placeUserFlowCardMutation.mutateAsync({
            expectedVersion: flow.data.version,
            kind,
            projectId,
            recordId,
            userFlowId: flow.data.id,
          });
        },
        onPreviewRebind: (bindId) =>
          client.previewUserFlowRebind({
            bindId,
            projectId,
            userFlowId: flow.data.id,
          }),
        onPromote: async (nodeId: string, choice: PromoteChoice) => {
          await promoteUserFlowNodeMutation.mutateAsync({
            expectedVersion: flow.data.version,
            nodeId,
            projectId,
            screen: choice,
            userFlowId: flow.data.id,
          });
        },
        onRebind: async (bindId: string, plan: UserFlowRebindPlan) => {
          await rebindUserFlowBindMutation.mutateAsync({
            bindId,
            plan,
            projectId,
            userFlowId: flow.data.id,
          });
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
                resetSave={saveUserFlowVersionMutation.reset}
                saveError={
                  saveUserFlowVersionMutation.variables?.userFlowId ===
                  flow.data.id
                    ? saveUserFlowVersionMutation.error
                    : undefined
                }
                saving={saveUserFlowVersionMutation.isPending}
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
