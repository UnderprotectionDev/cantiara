import type { ResearchBindingFeedback } from "@cantiara/api/research-session-bindings";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

/** Native record detail opened explicitly from a historical Evidence row. */
export function ResearchBindingFeedbackView({
  bindingId,
  sessionId,
  revision,
  read,
}: {
  bindingId: string;
  sessionId: string;
  revision: number;
  read: () => Promise<ResearchBindingFeedback>;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["research-binding-feedback", sessionId, revision, bindingId],
    queryFn: read,
    enabled: open,
    gcTime: 0,
  });
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>
        Open source record
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogTitle>Feedback</DialogTitle>
        <DialogDescription>Read-only source record.</DialogDescription>
        {query.isFetching || query.isPending ? (
          <p role="status">Loading source record…</p>
        ) : null}
        {!query.isFetching && query.isError ? (
          <p role="alert">Source record is unavailable.</p>
        ) : null}
        {!(query.isFetching || query.isError) && query.data ? (
          <div className="space-y-3">
            <h3 className="font-medium">{query.data.title}</h3>
            <p>{query.data.status}</p>
            <p className="whitespace-pre-wrap">{query.data.originalMessage}</p>
            {query.data.channel ? <p>Channel: {query.data.channel}</p> : null}
            <time dateTime={query.data.occurredAt}>
              {query.data.occurredAt}
            </time>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
