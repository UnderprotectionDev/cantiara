import type {
  MoveToTrashPreview,
  TrashSurfaceDisposition,
} from "@cantiara/api/trash";
import { useState } from "react";
import type { TrashCandidate } from "../lib/trash-candidates";

/**
 * The `Move to Trash` review state. The preview comes first: the founder sees
 * every attached External Surface before anything is committed.
 */
export function useMoveToTrashFlow({
  onMove,
  onPreview,
}: {
  onMove: (
    candidate: TrashCandidate,
    disposition: TrashSurfaceDisposition,
  ) => Promise<unknown>;
  onPreview: (candidate: TrashCandidate) => Promise<MoveToTrashPreview>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{
    candidate: TrashCandidate;
    preview: MoveToTrashPreview;
  } | null>(null);

  async function review(candidate: TrashCandidate) {
    const key = `${candidate.kind}:${candidate.id}`;
    setPending(key);
    setFailed(null);
    try {
      setReviewing({ candidate, preview: await onPreview(candidate) });
    } catch {
      setFailed(key);
    } finally {
      setPending(null);
    }
  }

  async function confirm(disposition: TrashSurfaceDisposition) {
    if (!reviewing) {
      return;
    }
    const { candidate } = reviewing;
    const key = `${candidate.kind}:${candidate.id}`;
    setPending(key);
    setFailed(null);
    try {
      await onMove(candidate, disposition);
      setReviewing(null);
    } catch {
      setFailed(key);
    } finally {
      setPending(null);
    }
  }

  return {
    cancel: () => setReviewing(null),
    confirm,
    failed,
    pending,
    review,
    reviewing,
  };
}
