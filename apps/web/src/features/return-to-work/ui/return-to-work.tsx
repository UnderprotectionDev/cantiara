// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their source record and field state.
import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import {
  nextConcreteStepSchema,
  type ReturnContext,
  type ReturnSource,
} from "@cantiara/api/return-to-work";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../account-preferences/lib/account-preferences-format";
import { runOnlineOnlyWrite } from "../../web-macos-client/store/client-shell";
import ReturnCards, { ReturnSourceLink } from "./return-cards";

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
function NextConcreteStepForm({
  context,
  preferences,
  source,
}: {
  context: ReturnContext;
  preferences: AccountPreferences;
  source: ReturnSource;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const form = useForm({
    defaultValues: { nextConcreteStep: source.nextConcreteStep ?? "" },
    onSubmit: async ({ value }) => {
      setError(null);
      setSaved(false);
      const parsed = nextConcreteStepSchema.safeParse(value.nextConcreteStep);
      if (!parsed.success) {
        setError("Next concrete step must be 4000 characters or fewer.");
        return;
      }
      const request = {
        ...context,
        baseRevision: source.revision,
        nextConcreteStep: parsed.data || null,
      };
      const fingerprint = JSON.stringify(request);
      const attempt =
        pending.current?.fingerprint === fingerprint
          ? pending.current
          : { fingerprint, key: crypto.randomUUID() };
      pending.current = attempt;
      try {
        await runOnlineOnlyWrite(() =>
          client.saveNextConcreteStep({
            ...request,
            clientIdempotencyKey: attempt.key,
          }),
        );
        pending.current = null;
        form.reset({ nextConcreteStep: parsed.data ?? "" });
        setSaved(true);
        await queryClient.invalidateQueries();
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Next concrete step could not be saved. Try again.",
        );
      }
    },
  });
  const fieldId = `next-concrete-step-${source.id}`;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="nextConcreteStep">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={fieldId}>Next concrete step</FieldLabel>
            <Textarea
              aria-describedby={error ? `${fieldId}-error` : undefined}
              id={fieldId}
              maxLength={4000}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
                setSaved(false);
              }}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <p className="text-muted-foreground text-sm">Optional · {source.title}</p>
      <div className="flex flex-wrap items-center gap-3">
        {source.nextConcreteStepUpdatedAt !== null && (
          <time
            className="text-muted-foreground text-xs"
            dateTime={source.nextConcreteStepUpdatedAt}
          >
            {formatAccountDateTime(
              source.nextConcreteStepUpdatedAt,
              preferences,
            )}
          </time>
        )}
        <ReturnSourceLink source={source} />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </div>
      {error !== null && (
        <p id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      )}
      {saved === true && <p role="status">Next concrete step saved.</p>}
    </form>
  );
}
