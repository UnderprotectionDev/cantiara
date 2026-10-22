// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { TestReviewSession } from "@cantiara/api/test-review";
import { supersedeInputSchema } from "@cantiara/api/test-review";
import { TEST_REVIEW_SUPERSEDES_LABEL } from "@cantiara/api/test-review-signals";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { allItems, endLine } from "../../lib/test-review-signal-lines";
import type { TestReviewSignalData } from "../../lib/test-review-signal-types";
import { errorText } from "../components/test-review-panel";

export default function TestReviewSupersedesForm({
  disabled,
  onSupersede,
  preferences,
  sessions,
  supersessions,
}: {
  disabled: boolean;
  onSupersede: (newerId: string, olderId: string) => Promise<unknown>;
  preferences?: AccountPreferences;
  sessions: TestReviewSession[];
  supersessions: TestReviewSignalData["supersessions"];
}) {
  const items = allItems(sessions, preferences);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const form = useForm({
    defaultValues: { newer: "", older: "" },
    onSubmit: async ({ value }) => {
      const parsed = supersedeInputSchema
        .pick({ newerSessionTestId: true, olderSessionTestId: true })
        .safeParse({
          newerSessionTestId: value.newer,
          olderSessionTestId: value.older,
        });
      if (
        !parsed.success ||
        parsed.data.newerSessionTestId === parsed.data.olderSessionTestId
      ) {
        return;
      }
      setError(undefined);
      setNotice(undefined);
      try {
        await onSupersede(
          parsed.data.newerSessionTestId,
          parsed.data.olderSessionTestId,
        );
        setNotice("Supersedes saved. Both historical results are kept.");
        form.reset();
      } catch (caught) {
        setError(errorText(caught, "Supersedes was not saved."));
      }
    },
  });
  const { newer, older } = useStore(form.store, (state) => state.values);
  const byId = new Map(
    sessions.flatMap((session) =>
      session.items.map((item) => [item.id, { item, session }] as const),
    ),
  );
  const newerRecord = byId.get(newer);
  const olderRecord = byId.get(older);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const pending = useStore(form.store, (state) => state.isSubmitting);

  return (
    <section
      aria-labelledby="test-review-supersedes-heading"
      className="space-y-3"
    >
      <h3 className="font-medium" id="test-review-supersedes-heading">
        {TEST_REVIEW_SUPERSEDES_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">
        A newer Session Test supersedes an older one of the same type. The
        relation is directed and acyclic; neither result is changed or deleted.
      </p>
      {items.length < 2 ? (
        <p className="text-muted-foreground text-sm">
          Two Session Tests are needed to relate them.
        </p>
      ) : (
        <form className="grid gap-2 text-sm" noValidate onSubmit={submit}>
          <label htmlFor="test-review-supersedes-newer">Newer result</label>
          <form.Field name="newer">
            {(field) => (
              <NativeSelect
                disabled={disabled || pending}
                id="test-review-supersedes-newer"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">
                  Choose a result
                </NativeSelectOption>
                {items.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
          <label htmlFor="test-review-supersedes-older">
            Older result it supersedes
          </label>
          <form.Field name="older">
            {(field) => (
              <NativeSelect
                disabled={disabled || pending}
                id="test-review-supersedes-older"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">
                  Choose a result
                </NativeSelectOption>
                {items.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
          {newerRecord && olderRecord ? (
            <p aria-live="polite">
              {`${newerRecord.item.title} (${newerRecord.item.normalizedResult ?? "Not reported"}) will supersede ${olderRecord.item.title} (${olderRecord.item.normalizedResult ?? "Not reported"}). Both stay in history.`}
            </p>
          ) : null}
          <div>
            <Button
              disabled={
                disabled || pending || !newer || !older || newer === older
              }
              type="submit"
            >
              {TEST_REVIEW_SUPERSEDES_LABEL}
            </Button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          {notice ? <p role="status">{notice}</p> : null}
        </form>
      )}
      {supersessions.length > 0 ? (
        <ul aria-label="Supersedes chain" className="space-y-2 text-sm">
          {supersessions.map((entry) => (
            <li
              className="rounded-md border border-border/60 p-3"
              key={entry.id}
            >
              <p>{`Supersedes: ${endLine(entry.newer)}`}</p>
              <p>{`Superseded: ${endLine(entry.older)}`}</p>
              {entry.difference.length > 0 ? (
                <ul aria-label="Technical context difference">
                  {entry.difference.map((difference) => (
                    <li key={difference.key}>
                      {`${difference.key}: ${difference.newer ?? "unknown"} (newer) vs ${difference.older ?? "unknown"} (older)`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recorded technical context difference.</p>
              )}
              {entry.reason ? <p>{`Reason: ${entry.reason}`}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
