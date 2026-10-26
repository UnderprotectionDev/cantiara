import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { ValueChainView } from "../views/value-chain-view";

/** Loads the Value Chain of one Project Goal. Read-only. */
export default function ValueChainSurface({
  goalId,
  projectId,
}: {
  goalId: string;
  projectId: string;
}) {
  const chain = useQuery(
    orpc.projectValueChain.queryOptions({ input: { goalId, projectId } }),
  );
  function retry() {
    chain.refetch().catch(() => undefined);
  }
  if (chain.isPending) {
    return <p role="status">Loading Value Chain…</p>;
  }
  if (!chain.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Value Chain is unavailable.</p>
        <Button onClick={retry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    );
  }
  return <ValueChainView chain={chain.data} projectId={projectId} />;
}
