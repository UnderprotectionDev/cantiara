// biome-ignore-all lint/performance/noJsxPropsBind: Research fields bind to their Work form.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectWorksQueryPrefix } from "@/utils/orpc";

export default function ResearchDirection({ work }: { work: WorkProfile }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: {
      problemOpportunity: string;
      expectedOutcome: string;
    }) =>
      runOnlineOnlyWrite(() =>
        client.updateResearchDirection({
          baseRevision: work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          expectedOutcome: value.expectedOutcome.trim() || null,
          problemOpportunity: value.problemOpportunity.trim() || null,
          workId: work.id,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
  });
  const form = useForm({
    defaultValues: {
      expectedOutcome: work.expectedOutcome ?? "",
      problemOpportunity: work.problemOpportunity ?? "",
    },
    onSubmit: ({ value }) => mutation.mutateAsync(value),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>
        <strong>Problem/Opportunity:</strong>{" "}
        {work.problemOpportunity || "Not recorded"}
      </p>
      <p>
        <strong>Expected Outcome:</strong>{" "}
        {work.expectedOutcome || "Not recorded"}
      </p>
      <details className="group">
        <summary className="cursor-pointer underline-offset-4 hover:underline">
          Edit
        </summary>
        <form className="mt-3 grid gap-3" onSubmit={submit}>
          <form.Field name="problemOpportunity">
            {(field) => (
              <label
                className="grid gap-1"
                htmlFor={`research-problem-${work.id}`}
              >
                Problem/Opportunity
                <Textarea
                  id={`research-problem-${work.id}`}
                  maxLength={2000}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="expectedOutcome">
            {(field) => (
              <label
                className="grid gap-1"
                htmlFor={`research-outcome-${work.id}`}
              >
                Expected Outcome
                <Textarea
                  id={`research-outcome-${work.id}`}
                  maxLength={2000}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <Button disabled={mutation.isPending} size="sm" type="submit">
            Save
          </Button>
          {mutation.isError ? (
            <p className="text-destructive" role="alert">
              Research direction could not be saved.
            </p>
          ) : null}
        </form>
      </details>
    </div>
  );
}
