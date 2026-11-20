// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the loaded Screen and editor.
import type { WireframeViewport } from "@cantiara/api/screen-viewport";
import type { ScreenWireframe } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  documentRecordHash,
  projectSourceRecordHash,
  workRecordHref,
} from "@/features/project-shell/lib/project-shell-navigation";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { presentSupportReferenceFailure } from "@/features/web-macos-client/ui/components/support-reference";
import { client, orpc } from "@/utils/orpc";
import { createWireframeEditor } from "../../engine/editor";
import type { OutlineSourceRecord } from "../../engine/outline";
import type { ConvertAndBindActions } from "../forms/convert-and-bind-form";
import type { LinkedBlockActions } from "./linked-block-controls";
import { WireframePane } from "./wireframe-pane";

const SAVE_DELAY_MS = 600;
const VIEWPORT_SAVE_DELAY_MS = 500;

/** Where `Open Source Record` goes; the record is read there, never copied. */
export function sourceRecordHref(
  projectId: string,
  source: OutlineSourceRecord,
) {
  const project = `/projects/${encodeURIComponent(projectId)}`;
  if (source.kind === "document") {
    return `${project}#${documentRecordHash(source.documentId)}`;
  }
  if (source.recordType === "Work") {
    return workRecordHref(projectId, source.recordId);
  }
  return `${project}#${projectSourceRecordHash(
    source.recordType === "Decision" ? "Decision" : "Risk",
    source.recordId,
  )}`;
}

function LoadedWireframe({
  projectId,
  readOnly,
  savedViewport,
  wireframe,
}: {
  projectId: string;
  readOnly: boolean;
  savedViewport: WireframeViewport | null;
  wireframe: ScreenWireframe;
}) {
  const saveScreenWireframeMutation = useMutation(
    orpc.saveScreenWireframe.mutationOptions({
      meta: { presentsSupportFailure: true },
      mutationFn: (input) => client.saveScreenWireframe(input),
    }),
  );
  const applyLinkedBlockChangeMutation = useMutation(
    orpc.applyLinkedBlockChange.mutationOptions({
      mutationFn: (input) => client.applyLinkedBlockChange(input),
    }),
  );
  const createLinkedBlockMutation = useMutation(
    orpc.createLinkedBlock.mutationOptions({
      mutationFn: (input) => client.createLinkedBlock(input),
    }),
  );
  const confirmConvertAndBindMutation = useMutation(
    orpc.confirmConvertAndBind.mutationOptions({
      mutationFn: (input) => client.confirmConvertAndBind(input),
    }),
  );
  const saveScreenWireframeVersionMutation = useMutation(
    orpc.saveScreenWireframeVersion.mutationOptions({
      mutationFn: (input) => client.saveScreenWireframeVersion(input),
    }),
  );
  const saveWireframe = saveScreenWireframeMutation.mutateAsync;
  const queryClient = useQueryClient();
  const { screenId } = wireframe;
  const options = useMemo(
    () => orpc.screenWireframe.queryOptions({ input: { projectId, screenId } }),
    [projectId, screenId],
  );
  // One session per Screen (the caller keys by Screen id); saves never rebuild it.
  const [editor] = useState(() => createWireframeEditor(wireframe.document));
  const router = useRouter();
  const saved = useRef(wireframe.document);

  // Each completed transaction schedules one write. The write goes straight
  // into the Wireframe cache entry: no Screen list or viewport refetch.
  useEffect(() => {
    // A failed write is shown once per failure streak (a Client Shell failure
    // with reason, retry bound, write outcome and Support reference) and flags
    // the unsaved risk; a write that lands ends the streak and clears the flag.
    let failing = false;
    async function write(
      document: ScreenWireframe["document"],
      retryCount: number,
    ) {
      try {
        const next = await saveWireframe({
          document,
          projectId,
          screenId,
        });
        saved.current = document;
        queryClient.setQueryData(options.queryKey, next);
        if (failing) {
          failing = false;
          defaultClientShell.markUnsavedChanges(false);
        }
      } catch (error) {
        defaultClientShell.markUnsavedChanges(true);
        if (!failing || retryCount > 0) {
          failing = true;
          presentSupportReferenceFailure(error, {
            kind: "mutation",
            retry: () => write(editor.getState().document, retryCount + 1),
            retryCount,
            writeOutcome: "not-written",
          });
        }
        // The next completed gesture schedules another write.
      }
    }
    const debouncer = new LiteDebouncer(
      (document: ScreenWireframe["document"]) => write(document, 0),
      { wait: SAVE_DELAY_MS },
    );
    const unsubscribe = editor.subscribe(() => {
      const { document } = editor.getState();
      if (document === saved.current) {
        return;
      }
      debouncer.maybeExecute(document);
    });
    return () => {
      debouncer.cancel();
      unsubscribe();
    };
  }, [
    editor,
    options.queryKey,
    projectId,
    queryClient,
    saveWireframe,
    screenId,
  ]);

  // The personal viewport has its own query key and write: a geometry write
  // never refetches it and a viewport write never touches the Wireframe cache
  // or the Screen list.
  const viewportOptions = orpc.screenViewport.queryOptions({
    input: { projectId, screenId },
  });
  const viewportDebouncer = useMemo(
    () =>
      new LiteDebouncer(
        async (viewport: WireframeViewport) => {
          try {
            await client.saveScreenViewport({ projectId, screenId, viewport });
          } catch {
            // Navigation is best effort; the next move schedules another write.
          }
        },
        { wait: VIEWPORT_SAVE_DELAY_MS },
      ),
    [projectId, screenId],
  );

  useEffect(() => () => viewportDebouncer.flush(), [viewportDebouncer]);

  function changeViewport(viewport: WireframeViewport) {
    queryClient.setQueryData(viewportOptions.queryKey, { viewport });
    viewportDebouncer.maybeExecute(viewport);
  }

  const linked: LinkedBlockActions = {
    apply: (definitionId, content) =>
      applyLinkedBlockChangeMutation.mutateAsync({
        content,
        definitionId,
        projectId,
      }),
    create: async (name, content) => {
      const record = await createLinkedBlockMutation.mutateAsync({
        content,
        name,
        projectId,
      });
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
      confirmConvertAndBindMutation.mutateAsync({
        originId: crypto.randomUUID(),
        plan,
        projectId,
        recordId: crypto.randomUUID(),
        screenId,
      }),
    preview: async (request) => {
      const flushed = await saveWireframe({
        document: editor.getState().document,
        projectId,
        screenId,
      });
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
    await saveScreenWireframeVersionMutation.mutateAsync({
      document: editor.getState().document,
      projectId,
      screenId,
    });
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
      onOpenSource={(source) => {
        router.history.push(sourceRecordHref(projectId, source));
      }}
      onSaveVersion={saveVersion}
      readOnly={readOnly}
      viewport={{ onChange: changeViewport, saved: savedViewport }}
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
  const viewportQuery = useQuery({
    ...orpc.screenViewport.queryOptions({ input: { projectId, screenId } }),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (query.status === "pending" || viewportQuery.isPending) {
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
      savedViewport={viewportQuery.data?.viewport ?? null}
      wireframe={query.data}
    />
  );
}
