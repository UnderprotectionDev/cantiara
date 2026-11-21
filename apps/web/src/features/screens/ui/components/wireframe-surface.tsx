// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the loaded Screen and editor.

import type { WireframeViewport } from "@cantiara/api/screen-viewport";
import type { ScreenWireframe } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  documentRecordHash,
  projectSourceRecordHash,
  workRecordHref,
} from "@/features/project-shell/lib/project-shell-navigation";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { presentSupportReferenceFailure } from "@/features/web-macos-client/ui/components/support-reference";
import { fetchFresh } from "@/lib/fetch-fresh";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
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
  const viewportWrite = useMutation(
    orpc.saveScreenViewport.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.saveScreenViewport(input),
    }),
  );
  const saveViewport = viewportWrite.mutate;
  const queryClient = useQueryClient();
  const { screenId } = wireframe;
  const options = useMemo(
    () => orpc.screenWireframe.queryOptions({ input: { projectId, screenId } }),
    [projectId, screenId],
  );
  const saveScope = `save-wireframe:${projectId}:${screenId}`;
  const saveOptions = orpc.saveScreenWireframe.mutationOptions({
    scope: { id: saveScope },
    meta: { onlineWrite: true, presentsSupportFailure: true },
    mutationFn: (input) => client.saveScreenWireframe(input),
    onSuccess: async (next) => {
      await queryClient.cancelQueries({
        exact: true,
        queryKey: options.queryKey,
      });
      queryClient.setQueryData(options.queryKey, next);
    },
  });
  const { mutateAsync: saveWireframe } = useMutation(saveOptions);
  const pendingDocuments = useMutationState({
    filters: {
      exact: true,
      mutationKey: saveOptions.mutationKey,
      predicate: (mutation) => mutation.options.scope?.id === saveScope,
      status: "pending",
    },
    // The mutation key and scope select only this Screen's Wireframe saves.
    select: ({ state }) =>
      (state.variables as { document: ScreenWireframe["document"] } | undefined)
        ?.document,
  });
  const saveScreenWireframeVersionMutation = usePreparedMutation(
    {
      mutationKey: orpc.saveScreenWireframeVersion.mutationKey(),
      mutationFn: (input: {
        clientIdempotencyKey: string;
        document: ScreenWireframe["document"];
        projectId: string;
        screenId: string;
      }) => client.saveScreenWireframeVersion(input),
      onSuccess: (_, { projectId: affectedProject }) =>
        queryClient.invalidateQueries({
          queryKey: orpc.projectScreens.key({
            input: { projectId: affectedProject },
          }),
        }),
    },
    (document: ScreenWireframe["document"]) => ({
      document,
      projectId,
      screenId,
    }),
  );
  // A fast reopen inherits the latest flushed document while its save is pending.
  const [editor] = useState(() =>
    createWireframeEditor(pendingDocuments.at(-1) ?? wireframe.document),
  );
  const router = useRouter();
  const saved = useRef(wireframe.document);

  // Each completed transaction schedules one write. The write goes straight
  // into the Wireframe cache entry: no Screen list or viewport refetch.
  useEffect(() => {
    // A failed write is shown once per failure streak (a Client Shell failure
    // with reason, retry bound, write outcome and Support reference) and flags
    // the unsaved risk; a write that lands ends the streak and clears the flag.
    let failing = false;
    let active = true;
    async function write(
      document: ScreenWireframe["document"],
      retryCount: number,
    ) {
      try {
        await saveWireframe({
          document,
          projectId,
          screenId,
        });
        saved.current = document;
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
            retry: active
              ? () => {
                  if (
                    active &&
                    editor.getState().document === document &&
                    saved.current !== document
                  ) {
                    return write(document, retryCount + 1);
                  }
                }
              : undefined,
            retryCount,
          });
        }
        // The next completed gesture schedules another write.
      }
    }
    const debouncer = new LiteDebouncer(
      (document: ScreenWireframe["document"]) => write(document, 0),
      { wait: SAVE_DELAY_MS },
    );
    let lastDocument = editor.getState().document;
    const unsubscribe = editor.subscribe(() => {
      const { document } = editor.getState();
      if (document === lastDocument) {
        return;
      }
      lastDocument = document;
      debouncer.maybeExecute(document);
    });
    return () => {
      active = false;
      unsubscribe();
      // A completed gesture belongs to this Screen even if the editor closes.
      debouncer.flush();
    };
  }, [editor, projectId, saveWireframe, screenId]);

  // The personal viewport has its own query key and write: a geometry write
  // never refetches it and a viewport write never touches the Wireframe cache
  // or the Screen list.
  const viewportOptions = orpc.screenViewport.queryOptions({
    input: { projectId, screenId },
  });
  const viewportDebouncer = useMemo(
    () =>
      new LiteDebouncer(
        (viewport: WireframeViewport) => {
          saveViewport({ projectId, screenId, viewport });
        },
        { wait: VIEWPORT_SAVE_DELAY_MS },
      ),
    [projectId, screenId, saveViewport],
  );

  useEffect(() => () => viewportDebouncer.flush(), [viewportDebouncer]);

  function changeViewport(viewport: WireframeViewport) {
    queryClient.setQueryData(viewportOptions.queryKey, { viewport });
    viewportDebouncer.maybeExecute(viewport);
  }

  const linked: LinkedBlockActions = {
    apply: async (
      definitionId,
      content,
      expectedRevision,
      clientIdempotencyKey,
    ) => {
      const applied = await client.applyLinkedBlockChange({
        clientIdempotencyKey,
        content,
        definitionId,
        expectedRevision,
        projectId,
      });
      await Promise.all(
        applied.affectedScreens.map(({ screenId: affectedScreenId }) =>
          queryClient.invalidateQueries({
            queryKey: orpc.screenWireframe.key({
              input: { projectId, screenId: affectedScreenId },
            }),
          }),
        ),
      );
      return applied;
    },
    create: async (name, content, clientIdempotencyKey) => {
      const record = await client.createLinkedBlock({
        clientIdempotencyKey,
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
      fetchFresh(queryClient, {
        ...orpc.previewLinkedBlockChange.queryOptions({
          input: { content, definitionId, projectId },
        }),
        gcTime: 0,
      }),
  };

  // Convert and Bind names an exact stored version, so the current document is
  // flushed first and the preview and confirm address the version that returns.
  const convert: ConvertAndBindActions = {
    confirm: async (input) => {
      const created = await client.confirmConvertAndBind(input);
      const target = { input: { projectId: created.target.projectId } };
      const targetQueries = {
        Decision: orpc.projectDecisions.key,
        "Open Question": orpc.openQuestions.key,
        Risk: orpc.projectRisks.key,
        Work: orpc.projectWorks.key,
      };
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.screenOrigins.key({
            input: { projectId: input.projectId, screenId: input.screenId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: targetQueries[created.target.type](target),
        }),
        ...invalidateSmartCollectionMembership(queryClient),
      ]);
      return created;
    },
    preview: async (request) => {
      const { document } = editor.getState();
      const flushed = await saveWireframe({ document, projectId, screenId });
      saved.current = document;
      return fetchFresh(queryClient, {
        ...orpc.previewConvertAndBind.queryOptions({
          input: {
            ...request,
            projectId,
            screenId,
            wireframeVersion: flushed.version,
          },
        }),
        gcTime: 0,
      });
    },
  };

  async function saveVersion() {
    await saveScreenWireframeVersionMutation.mutateAsync(
      editor.getState().document,
    );
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
