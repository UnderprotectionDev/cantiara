import type { EvidenceFlowSourceType } from "@cantiara/api/document-evidence";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { orpc } from "@/utils/orpc";
import EvidenceFlow from "./evidence-flow";

/** Read-only: the derived flow is queried only once the founder opens it, and nothing is written. */
export default function EvidenceFlowPanel({
  projectId,
  recordId,
  type,
}: {
  projectId: string;
  recordId: string;
  type: "Work" | "Decision" | "Assumption";
}) {
  return (
    <Collapsible className="space-y-2">
      <CollapsibleTrigger render={<Button variant="outline" />}>
        Evidence Flow
      </CollapsibleTrigger>
      <CollapsibleContent>
        <EvidenceFlowQuery
          projectId={projectId}
          recordId={recordId}
          type={type}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function EvidenceFlowQuery({
  projectId,
  recordId,
  type,
}: {
  projectId: string;
  recordId: string;
  type: "Work" | "Decision" | "Assumption";
}) {
  const sourceType = useSearch({
    from: "/_auth/projects/$projectId/",
    select: (search) =>
      search.evidence?.subjectId === recordId
        ? search.evidence.sourceType
        : null,
  });
  const navigate = useNavigate();
  const setSourceType = useCallback(
    (next: EvidenceFlowSourceType | null) => {
      navigate({
        hash: true,
        search: (current) => ({
          ...current,
          evidence: next
            ? { subjectId: recordId, sourceType: next }
            : undefined,
        }),
        to: ".",
      }).catch(() => undefined);
    },
    [navigate, recordId],
  );
  const flow = useQuery(
    orpc.evidenceFlow.queryOptions({
      input: {
        projectId,
        recordId,
        type,
        ...(sourceType ? { sourceType } : {}),
      },
    }),
  );
  if (flow.isError || flow.data === null) {
    return <p role="alert">Evidence Flow is unavailable.</p>;
  }
  return (
    <EvidenceFlow
      onSourceTypeChange={setSourceType}
      rows={flow.data}
      sourceType={sourceType}
    />
  );
}
