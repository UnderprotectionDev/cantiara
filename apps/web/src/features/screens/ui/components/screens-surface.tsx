import type {
  ScreenLifecycleAction,
  ScreenRecord,
} from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";
import type { ScreenTemplateActions } from "../../lib/screen-template-actions";
import { ScreensView } from "../views/screens-view";
import ScreensOutputSurface from "./screens-output-surface";
import WireframeSurface from "./wireframe-surface";

export default function ScreensSurface({ projectId }: { projectId: string }) {
  const createScreenMutation = useMutation(
    orpc.createScreen.mutationOptions({
      mutationFn: (input) => client.createScreen(input),
      onSuccess: () => refresh(),
    }),
  );
  const createScreenFromTemplateMutation = useMutation(
    orpc.createScreenFromTemplate.mutationOptions({
      mutationFn: (input) => client.createScreenFromTemplate(input),
      onSuccess: () => refresh(),
    }),
  );
  const saveScreenTemplateMutation = useMutation(
    orpc.saveScreenTemplate.mutationOptions({
      mutationFn: (input) => client.saveScreenTemplate(input),
    }),
  );
  const setScreenLifecycleMutation = useMutation(
    orpc.setScreenLifecycle.mutationOptions({
      mutationFn: (input) => client.setScreenLifecycle(input),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectScreens.queryOptions({ input: { projectId } });
  const screens = useQuery(options);
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
  }
  async function create(title: string) {
    await createScreenMutation.mutateAsync({ projectId, title });
  }
  const templateOptions = orpc.screenTemplates.queryOptions({
    input: { projectId },
  });
  const templateList = useQuery(templateOptions);
  const templates: ScreenTemplateActions = {
    create: async (templateId, title) => {
      await createScreenFromTemplateMutation.mutateAsync({
        projectId,
        templateId,
        title,
      });
    },
    save: async (screen, wireframeVersion, name) => {
      await saveScreenTemplateMutation.mutateAsync({
        name,
        projectId,
        screenId: screen.id,
        wireframeVersion,
      });
      await queryClient.invalidateQueries({
        queryKey: templateOptions.queryKey,
      });
    },
    templates: templateList.data ?? [],
  };
  async function setLifecycle(
    screen: ScreenRecord,
    action: ScreenLifecycleAction,
  ) {
    try {
      await setScreenLifecycleMutation.mutateAsync({
        action,
        expectedRevision: screen.revision,
        projectId,
        screenId: screen.id,
      });
    } finally {
      await refresh();
    }
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
