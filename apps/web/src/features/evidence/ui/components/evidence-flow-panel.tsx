import type { EvidenceFlowSourceType } from "@cantiara/api/document-evidence";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  const [sourceType, setSourceType] = useState<EvidenceFlowSourceType | null>(
    null,
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
