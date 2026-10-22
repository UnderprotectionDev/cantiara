// biome-ignore-all lint/performance/noJsxPropsBind: Research fields bind to their Work form.
import { updateResearchDirectionInputSchema } from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import type { z } from "zod";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectWorksQueryPrefix } from "@/utils/orpc";

export default function ResearchDirection({ work }: { work: WorkProfile }) {
  const queryClient = useQueryClient();
  const [invalid, setInvalid] = useState(false);
  const mutation = useMutation({
    mutationFn: (input: z.output<typeof updateResearchDirectionInputSchema>) =>
      runOnlineOnlyWrite(() => client.updateResearchDirection(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
  });
  const form = useForm({
    defaultValues: {
      expectedOutcome: work.expectedOutcome ?? "",
      problemOpportunity: work.problemOpportunity ?? "",
    },
    onSubmit: ({ value }) => {
      const parsed = updateResearchDirectionInputSchema.safeParse({
        baseRevision: work.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        expectedOutcome: value.expectedOutcome.trim() || null,
        problemOpportunity: value.problemOpportunity.trim() || null,
        workId: work.id,
      });
      setInvalid(!parsed.success);
      if (!parsed.success) {
        return;
      }
      return mutation.mutateAsync(parsed.data);
    },
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
          {invalid || mutation.isError ? (
            <p className="text-destructive" role="alert">
              Research direction could not be saved.
            </p>
          ) : null}
        </form>
      </details>
    </div>
  );
}
