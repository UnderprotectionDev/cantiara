import type { EvidenceFlowSourceType } from "@cantiara/api/document-evidence";
import { Button } from "@cantiara/ui/components/button";
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
  const [expanded, setExpanded] = useState(false);
  function toggleExpanded() {
    setExpanded((open) => !open);
  }
  return (
    <div className="space-y-2">
      <Button
        aria-expanded={expanded}
        onClick={toggleExpanded}
        type="button"
        variant="outline"
      >
        Evidence Flow
      </Button>
      {expanded ? (
        <EvidenceFlowQuery
          projectId={projectId}
          recordId={recordId}
          type={type}
        />
      ) : null}
    </div>
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
