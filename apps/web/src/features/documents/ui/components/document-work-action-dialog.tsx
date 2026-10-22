// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import WorkStatusForm from "@/components/work-status-form";

export default function DocumentWorkActionDialog({
  setWorkAction,
  queryClient,
  liveWorkOptions,
  workAction,
  actionWork,
}: {
  setWorkAction: import("react").Dispatch<
    import("react").SetStateAction<{
      id: string;
      kind: "status" | "close";
      requestId: string;
    } | null>
  >;
  queryClient: import("@tanstack/react-query").QueryClient;
  liveWorkOptions: { input: { documentId: string; body: string } } & Omit<
    import("@orpc/tanstack-query").QueryOptionsBase<
      {
        workId: string;
        source: import("@cantiara/api/documents").LiveWorkSource | null;
      }[],
      Error
    >,
    "input"
  >;
  workAction: {
    id: string;
    kind: "status" | "close";
    requestId: string;
  } | null;
  actionWork: import("@tanstack/react-query").UseQueryResult<
    WorkProfile,
    Error
  >;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setWorkAction(null);
          queryClient.invalidateQueries({
            queryKey: liveWorkOptions.queryKey,
          });
        }
      }}
      open={workAction !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {workAction?.kind === "close" ? "Close" : "Change status"}
          </DialogTitle>
          <DialogDescription>
            {actionWork.data?.key} · {actionWork.data?.title}
          </DialogDescription>
        </DialogHeader>
        {actionWork.data && !actionWork.isFetching && workAction ? (
          <WorkStatusForm
            completionFeedback={{
              effect: null,
              noticeVisible: false,
              reopenStatus: null,
            }}
            onCloseOutcome={() =>
              queryClient.invalidateQueries({
                queryKey: liveWorkOptions.queryKey,
              })
            }
            onRequestedStatusActionHandled={() => undefined}
            requestedStatusAction={
              workAction.kind === "close"
                ? { id: workAction.requestId, status: "Closed" }
                : null
            }
            work={actionWork.data}
            workStatusLabels={[]}
          />
        ) : (
          <p role="status">Loading source record…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
