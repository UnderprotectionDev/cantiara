// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their source record and field state.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ReturnContext } from "@cantiara/api/return-to-work";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";
import { runOnlineOnlyWrite } from "../../../web-macos-client/store/client-shell";
import { NextConcreteStepForm } from "../forms/next-concrete-step-form";
import ReturnCards from "./return-cards";
import SinceLastLooked from "./since-last-looked";

export default function ReturnToWork({ projectId, workId }: ReturnContext) {
  const input = { projectId, ...(workId ? { workId } : {}) };
  const query = useQuery({
    ...orpc.returnToWork.queryOptions({ input }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const preferences =
    useQuery(accountPreferencesQueryOptions()).data ??
    DEFAULT_ACCOUNT_PREFERENCES;
  const [visitError, setVisitError] = useState(false);
  const viewedContext = useRef<string | null>(null);
  const visitsInFlight = useRef(new Set<string>());
  const markViewed = useCallback(() => {
    const contextKey = `${projectId}:${workId ?? ""}`;
    if (
      viewedContext.current === contextKey ||
      visitsInFlight.current.has(contextKey) ||
      document.visibilityState !== "visible" ||
      !query.isSuccess ||
      query.isFetching
    ) {
      return;
    }
    visitsInFlight.current.add(contextKey);
    runOnlineOnlyWrite(() =>
      client.markReturnContextViewed({
        projectId,
        ...(workId ? { workId } : {}),
      }),
    )
      .then(() => {
        viewedContext.current = contextKey;
        setVisitError(false);
      })
      .catch(() => setVisitError(true))
      .finally(() => visitsInFlight.current.delete(contextKey));
  }, [projectId, workId, query.isSuccess, query.isFetching]);
  useEffect(() => {
    markViewed();
    document.addEventListener("visibilitychange", markViewed);
    window.addEventListener("online", markViewed);
    return () => {
      document.removeEventListener("visibilitychange", markViewed);
      window.removeEventListener("online", markViewed);
    };
  }, [markViewed]);
  return (
    <section aria-label="Return to Work" className="space-y-5 border-t pt-6">
      <h2 className="font-semibold text-lg">Return to Work</h2>
      <p className="text-muted-foreground text-sm">
        Up to five cards from current records. Recent activity covers the last
        seven days; upcoming dates cover today and the next seven days.
      </p>
      {query.data?.source && !query.isError && (
        <NextConcreteStepForm
          context={input}
          key={query.data.source.id}
          preferences={preferences}
          readOnly={query.data.readOnly}
          source={query.data.source}
        />
      )}
      {(query.isPending === true || query.isFetching === true) && (
        <p role="status">Loading…</p>
      )}
      {query.isError === true && (
        <div role="alert">
          <p>Return to Work is unavailable. Try loading it again.</p>
          <Button onClick={() => query.refetch()} variant="outline">
            Retry
          </Button>
        </div>
      )}
      {query.isSuccess === true &&
        !query.isFetching &&
        (query.data.cards.length > 0 ? (
          <ReturnCards cards={query.data.cards} preferences={preferences} />
        ) : (
          <p className="text-muted-foreground text-sm">No return cards yet.</p>
        ))}
      {query.isSuccess === true && (
        <SinceLastLooked
          changes={query.data.sinceLastLooked}
          preferences={preferences}
          projectId={projectId}
        />
      )}
      {visitError === true && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground text-sm" role="status">
            The last visit could not be saved.
          </p>
          <Button onClick={markViewed} variant="outline">
            Retry
          </Button>
        </div>
      )}
    </section>
  );
}
