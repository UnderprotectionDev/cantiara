// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the loaded Screen and editor.
import type { ScreenWireframe } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { createWireframeEditor } from "../engine/editor";
import type { ConvertAndBindActions } from "./convert-and-bind-panel";
import type { LinkedBlockActions } from "./linked-block-controls";
import { WireframePane } from "./wireframe-pane";

const SAVE_DELAY_MS = 600;

function LoadedWireframe({
  projectId,
  readOnly,
  wireframe,
}: {
  projectId: string;
  readOnly: boolean;
  wireframe: ScreenWireframe;
}) {
  const queryClient = useQueryClient();
  const { screenId } = wireframe;
  const options = orpc.screenWireframe.queryOptions({
    input: { projectId, screenId },
  });
  // One session per Screen (the caller keys by Screen id); saves never rebuild it.
  const [editor] = useState(() => createWireframeEditor(wireframe.document));
  const saved = useRef(wireframe.document);

  // Each completed transaction schedules one write. The write goes straight
  // into the Wireframe cache entry: no Screen list or viewport refetch.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = editor.subscribe(() => {
      const { document } = editor.getState();
      if (document === saved.current) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const next = await runOnlineOnlyWrite(() =>
            client.saveScreenWireframe({ document, projectId, screenId }),
          );
          saved.current = document;
          queryClient.setQueryData(options.queryKey, next);
        } catch {
          // The next completed gesture schedules another write.
        }
      }, SAVE_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [editor, options.queryKey, projectId, queryClient, screenId]);

  const linked: LinkedBlockActions = {
    apply: (definitionId, content) =>
      runOnlineOnlyWrite(() =>
        client.applyLinkedBlockChange({ content, definitionId, projectId }),
      ),
    create: async (name, content) => {
      const record = await runOnlineOnlyWrite(() =>
        client.createLinkedBlock({ content, name, projectId }),
      );
      return {
        content: record.content,
        id: record.id,
        name: record.name,
        revision: record.revision,
      };
    },
    preview: (definitionId, content) =>
      client.previewLinkedBlockChange({ content, definitionId, projectId }),
  };

  // Convert and Bind names an exact stored version, so the current document is
  // flushed first and the preview and confirm address the version that returns.
  const convert: ConvertAndBindActions = {
    confirm: (plan) =>
      runOnlineOnlyWrite(() =>
        client.confirmConvertAndBind({
          originId: crypto.randomUUID(),
          plan,
          projectId,
          recordId: crypto.randomUUID(),
          screenId,
        }),
      ),
    preview: async (request) => {
      const flushed = await runOnlineOnlyWrite(() =>
        client.saveScreenWireframe({
          document: editor.getState().document,
          projectId,
          screenId,
        }),
      );
      saved.current = editor.getState().document;
      queryClient.setQueryData(options.queryKey, flushed);
      return client.previewConvertAndBind({
        ...request,
        projectId,
        screenId,
        wireframeVersion: flushed.version,
      });
    },
  };

  async function saveVersion() {
    await runOnlineOnlyWrite(() =>
      client.saveScreenWireframeVersion({
        document: editor.getState().document,
        projectId,
        screenId,
      }),
    );
    await queryClient.invalidateQueries({
      queryKey: orpc.projectScreens.queryOptions({ input: { projectId } })
        .queryKey,
    });
  }

  return (
    <WireframePane
      convert={convert}
      editor={editor}
      linked={linked}
      liveCards={wireframe.liveCards}
      liveText={wireframe.liveText}
      onSaveVersion={saveVersion}
      readOnly={readOnly}
    />
  );
}

export default function WireframeSurface({
  projectId,
  readOnly,
  screenId,
}: {
  projectId: string;
  readOnly: boolean;
  screenId: string;
}) {
  const query = useQuery(
    orpc.screenWireframe.queryOptions({ input: { projectId, screenId } }),
  );
  if (query.isPending) {
    return <p role="status">Loading Wireframe…</p>;
  }
  if (!query.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Wireframe is unavailable.</p>
        <Button onClick={() => query.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <LoadedWireframe
      key={screenId}
      projectId={projectId}
      readOnly={readOnly}
      wireframe={query.data}
    />
  );
}
