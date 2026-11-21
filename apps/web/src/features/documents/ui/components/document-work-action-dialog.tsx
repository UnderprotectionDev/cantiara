// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import {
  type createDialogHandle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import WorkStatusForm from "@/components/work-status-form";
import { orpc } from "@/utils/orpc";

export interface DocumentWorkAction {
  id: string;
  kind: "status" | "close";
  requestId: string;
}

export default function DocumentWorkActionDialog({
  handle,
  queryClient,
  liveWorkOptions,
}: {
  handle: ReturnType<typeof createDialogHandle<DocumentWorkAction>>;
  queryClient: import("@tanstack/react-query").QueryClient;
  liveWorkOptions: ReturnType<typeof orpc.documentLiveWorkBlocks.queryOptions>;
}) {
  function invalidate() {
    return queryClient.invalidateQueries({
      queryKey: liveWorkOptions.queryKey,
    });
  }

  return (
    <Dialog
      handle={handle}
      onOpenChange={(open) => {
        if (!open) {
          invalidate().catch(() => undefined);
        }
      }}
    >
      {({ payload }) =>
        payload ? (
          <DialogContent>
            <DocumentWorkActionContent
              invalidate={invalidate}
              key={payload.requestId}
              workAction={payload}
            />
          </DialogContent>
        ) : null
      }
    </Dialog>
  );
}

function DocumentWorkActionContent({
  invalidate,
  workAction,
}: {
  invalidate: () => Promise<void>;
  workAction: DocumentWorkAction;
}) {
  const actionWork = useQuery({
    ...orpc.work.queryOptions({ input: { workId: workAction.id } }),
    refetchOnMount: "always",
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {workAction.kind === "close" ? "Close" : "Change status"}
        </DialogTitle>
        <DialogDescription>
          {actionWork.data?.key} · {actionWork.data?.title}
        </DialogDescription>
      </DialogHeader>
      {actionWork.data && !actionWork.isFetching ? (
        <WorkStatusForm
          completionFeedback={{
            effect: null,
            noticeVisible: false,
            reopenStatus: null,
          }}
          onCloseOutcome={invalidate}
          onRequestedStatusActionHandled={() => undefined}
          requestedStatusAction={
            workAction.kind === "close"
              ? { id: workAction.requestId, status: "Closed" }
              : null
          }
          work={actionWork.data}
          workStatusLabels={[]}
        />
      ) : null}
      {actionWork.isError ? (
        <p role="alert">Source record is unavailable.</p>
      ) : null}
      {actionWork.isFetching ? (
        <p role="status">Loading source record…</p>
      ) : null}
    </>
  );
}
