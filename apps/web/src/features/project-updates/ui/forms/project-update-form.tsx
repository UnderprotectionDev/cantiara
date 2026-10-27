// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  CREATE_PROJECT_UPDATE_LABEL,
  PROJECT_UPDATE_LABEL,
  PROJECT_UPDATE_MARKS,
  PROJECT_UPDATE_NARRATIVE_MAX,
} from "@cantiara/api/project-updates";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  EMPTY_PROJECT_UPDATE_DRAFT,
  type ProjectUpdateLinkCandidate,
  projectUpdateFormSchema,
  projectUpdateLinkFromKey,
} from "../../lib/project-update-form";

const markSlug = (mark: string) => mark.toLowerCase().replaceAll(" ", "-");

export interface ProjectUpdateFormSubmit {
  links: NonNullable<ReturnType<typeof projectUpdateLinkFromKey>>[];
  mark: (typeof PROJECT_UPDATE_MARKS)[number];
  narrative: string;
}

/**
 * Create a Project Update: one of three marks, a short narrative and optional
 * links to live records. Saving appends a dated entry; the form never edits a
 * saved one, and it names no health of the Project itself.
 */
export function ProjectUpdateForm({
  candidates,
  onSubmit,
}: {
  candidates: readonly ProjectUpdateLinkCandidate[];
  onSubmit: (values: ProjectUpdateFormSubmit) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: EMPTY_PROJECT_UPDATE_DRAFT,
    onSubmit: async ({ formApi, value }) => {
      setError(null);
      const parsed = projectUpdateFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Choose a mark and write a short narrative.");
        return;
      }
      const links = parsed.data.links.flatMap((key) => {
        const link = projectUpdateLinkFromKey(key);
        return link ? [link] : [];
      });
      try {
        await onSubmit({ ...parsed.data, links });
        formApi.reset();
      } catch {
        setError(
          "Project Update could not be saved. Retry; your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={CREATE_PROJECT_UPDATE_LABEL}
      className="space-y-4"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="mark">
              {(field) => (
                <fieldset className="grid gap-2">
                  <legend className="text-sm">Mark</legend>
                  <RadioGroup
                    className="flex w-auto flex-wrap gap-4"
                    disabled={isSubmitting}
                    name="project-update-mark"
                    onValueChange={(next) => {
                      const mark = PROJECT_UPDATE_MARKS.find(
                        (option) => option === next,
                      );
                      if (mark) {
                        field.handleChange(mark);
                      }
                    }}
                    required
                    value={field.state.value}
                  >
                    {PROJECT_UPDATE_MARKS.map((mark) => (
                      <label
                        className="inline-flex items-center gap-2 text-sm"
                        htmlFor={`project-update-mark-${markSlug(mark)}`}
                        key={mark}
                      >
                        <RadioGroupItem
                          id={`project-update-mark-${markSlug(mark)}`}
                          value={mark}
                        />
                        {mark}
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              )}
            </form.Field>
            <form.Field name="narrative">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-update-narrative"
                >
                  Narrative
                  <Textarea
                    disabled={isSubmitting}
                    id="project-update-narrative"
                    maxLength={PROJECT_UPDATE_NARRATIVE_MAX}
                    name="narrative"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            {candidates.length > 0 ? (
              <form.Field name="links">
                {(field) => (
                  <fieldset className="grid gap-2">
                    <legend className="text-sm">
                      Linked records (optional)
                    </legend>
                    <ul className="grid gap-2">
                      {candidates.map((candidate) => (
                        <li key={candidate.key}>
                          <label
                            className="inline-flex items-center gap-2 text-sm"
                            htmlFor={`project-update-link-${candidate.key}`}
                          >
                            <Checkbox
                              checked={field.state.value.includes(
                                candidate.key,
                              )}
                              disabled={isSubmitting}
                              id={`project-update-link-${candidate.key}`}
                              onCheckedChange={(checked) =>
                                field.handleChange(
                                  checked
                                    ? [...field.state.value, candidate.key]
                                    : field.state.value.filter(
                                        (key) => key !== candidate.key,
                                      ),
                                )
                              }
                            />
                            <span>
                              {candidate.type}: {candidate.label}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                )}
              </form.Field>
            ) : null}
            <p className="text-muted-foreground text-sm">
              The mark is your own judgment of this day. Saving adds a dated{" "}
              {PROJECT_UPDATE_LABEL} and freezes the summary above as it is now;
              a saved {PROJECT_UPDATE_LABEL} is never rewritten.
            </p>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving…" : "Create Project Update"}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
