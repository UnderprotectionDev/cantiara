import type {
  ScreenLifecycleAction,
  ScreenRecord,
} from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import type { ScreenTemplateActions } from "../../lib/screen-template-actions";
import { ScreensView } from "../views/screens-view";
import ScreensOutputSurface from "./screens-output-surface";
import WireframeSurface from "./wireframe-surface";

export default function ScreensSurface({ projectId }: { projectId: string }) {
  const refresh = (_result: unknown, input: { projectId: string }) =>
    queryClient.invalidateQueries({
      queryKey: orpc.projectScreens.key({
        input: { projectId: input.projectId },
      }),
    });
  const createScreenMutation = usePreparedMutation(
    {
      mutationKey: orpc.createScreen.mutationKey(),
      mutationFn: (input: {
        clientIdempotencyKey: string;
        projectId: string;
        title: string;
      }) => client.createScreen(input),
      onSuccess: refresh,
    },
    (title: string) => ({ projectId, title }),
  );
  const createScreenFromTemplateMutation = usePreparedMutation(
    {
      mutationKey: orpc.createScreenFromTemplate.mutationKey(),
      mutationFn: (input: {
        clientIdempotencyKey: string;
        projectId: string;
        templateId: string;
        title: string;
      }) => client.createScreenFromTemplate(input),
      onSuccess: refresh,
    },
    ({ templateId, title }: { templateId: string; title: string }) => ({
      projectId,
      templateId,
      title,
    }),
  );
  const setScreenLifecycleMutation = useMutation(
    orpc.setScreenLifecycle.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setScreenLifecycle(input),
      onSettled: (_, _error, { projectId: affectedProject }) =>
        queryClient.invalidateQueries({
          queryKey: orpc.projectScreens.key({
            input: { projectId: affectedProject },
          }),
        }),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectScreens.queryOptions({ input: { projectId } });
  const screens = useQuery(options);
  async function create(title: string) {
    await createScreenMutation.mutateAsync(title);
  }
  const templateOptions = orpc.screenTemplates.queryOptions({
    input: { projectId },
  });
  const templateList = useQuery(templateOptions);
  const templates: ScreenTemplateActions = {
    create: async (templateId, title) => {
      await createScreenFromTemplateMutation.mutateAsync({ templateId, title });
    },
    save: async (screen, wireframeVersion, name, clientIdempotencyKey) => {
      await client.saveScreenTemplate({
        clientIdempotencyKey,
        name,
        projectId,
        screenId: screen.id,
        wireframeVersion,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.screenTemplates.key({ input: { projectId } }),
      });
    },
    templates: templateList.data ?? [],
  };
  async function setLifecycle(
    screen: ScreenRecord,
    action: ScreenLifecycleAction,
  ) {
    await setScreenLifecycleMutation.mutateAsync({
      action,
      expectedRevision: screen.revision,
      projectId,
      screenId: screen.id,
    });
  }
  function renderWireframe(screen: ScreenRecord) {
    return (
      <WireframeSurface
        projectId={projectId}
        readOnly={screens.data?.readOnly ?? true}
        screenId={screen.id}
      />
    );
  }
  function retry() {
    screens.refetch().catch(() => undefined);
  }
  if (screens.status === "pending") {
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
    <div className="space-y-6">
      <ScreensView
        lifecycleWrite={{
          failed: setScreenLifecycleMutation.isError,
          pending: setScreenLifecycleMutation.isPending,
          screenId: setScreenLifecycleMutation.variables?.screenId,
        }}
        onCreate={create}
        onSetLifecycle={setLifecycle}
        readOnly={screens.data.readOnly}
        renderWireframe={renderWireframe}
        screens={screens.data.screens}
        templates={templates}
      />
      <ScreensOutputSurface
        projectId={projectId}
        screens={screens.data.screens}
      />
    </div>
  );
}
