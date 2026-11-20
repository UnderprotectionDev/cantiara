// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.

import {
  type FocusPeriodLearning,
  type FocusPeriodRecord,
  focusPeriodFollowUpWorkInputSchema,
  focusPeriodLearningSchema,
} from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { submitForm } from "@/lib/submit-form";
import { orpc } from "@/utils/orpc";
import type {
  FocusPeriodAction,
  FocusPeriodCreateFollowUp,
} from "../../lib/focus-period-actions";

const EVALUATION_FIELD_BY_LEARNING = {
  Keep: "keep",
  Change: "change",
  "Try next": "tryNext",
} as const;

export function FollowUpWorkSection({
  period,
  createFollowUp,
  act,
}: {
  period: FocusPeriodRecord;
  createFollowUp: FocusPeriodCreateFollowUp;
  act: FocusPeriodAction;
}) {
  const projectsQuery = useQuery(orpc.projects.queryOptions());
  const projects = (projectsQuery.data ?? []).filter(
    (item) => item.status === "Active" || item.status === "Pending",
  );
  const form = useForm({
    defaultValues: {
      learning: "Try next" as FocusPeriodLearning,
      projectId: "",
      title: "",
      description: "",
      previewed: false,
      clientIdempotencyKey: "",
    },
    onSubmitMeta: { action: "preview" } as { action: "preview" | "confirm" },
    onSubmit: async ({ formApi, meta, value }) => {
      const { description, learning, projectId, title } = value;
      const clientIdempotencyKey =
        value.clientIdempotencyKey || crypto.randomUUID();
      const parsed = focusPeriodFollowUpWorkInputSchema.safeParse({
        periodId: period.id,
        learning,
        projectId,
        title,
        type: "Task",
        clientIdempotencyKey,
        ...(description.trim() ? { description } : {}),
      });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the form.",
            fields: {},
          },
        });
        return;
      }
      if (meta.action === "preview") {
        formApi.setFieldValue("clientIdempotencyKey", clientIdempotencyKey);
        formApi.setFieldValue("previewed", true);
        return;
      }
      if (value.previewed) {
        await act(async () => {
          await createFollowUp.mutateAsync(parsed.data);
          formApi.reset(
            {
              ...value,
              title: "",
              description: "",
              clientIdempotencyKey: "",
              previewed: false,
            },
            { keepDefaultValues: true },
          );
        });
      }
    },
  });
  const { description, learning, previewed, projectId, title } = useSelector(
    form.store,
    (state) => state.values,
  );
  const learningText =
    period.evaluation?.[EVALUATION_FIELD_BY_LEARNING[learning]] ?? "";
  function editDraft(update: () => void) {
    update();
    form.setFieldValue("clientIdempotencyKey", "");
    form.setFieldValue("previewed", false);
    form.setErrorMap({ onSubmit: undefined });
  }
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  return (
    <>
      <section aria-label="Add follow-up Work" className="space-y-3">
        <h3 className="font-semibold">Add follow-up Work</h3>
        <p className="text-sm text-muted-foreground">
          Review the Work and its source learning before confirming. No Work is
          created until you confirm.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submitForm(form).catch(() => undefined);
          }}
        >
          <form.Field name="learning">
            {(field) => (
              <label
                className="flex flex-col gap-1"
                htmlFor="focus-period-follow-up-learning"
              >
                Learning source
                <NativeSelect
                  className="w-full"
                  id="focus-period-follow-up-learning"
                  name={field.name}
                  onChange={(event) => {
                    const next = focusPeriodLearningSchema.safeParse(
                      event.target.value,
                    );
                    if (next.success) {
                      editDraft(() => field.handleChange(next.data));
                    }
                  }}
                  value={field.state.value}
                >
                  <NativeSelectOption>Keep</NativeSelectOption>
                  <NativeSelectOption>Change</NativeSelectOption>
                  <NativeSelectOption>Try next</NativeSelectOption>
                </NativeSelect>
              </label>
            )}
          </form.Field>
          <form.Field name="projectId">
            {(field) => (
              <label
                className="flex flex-col gap-1"
                htmlFor="focus-period-follow-up-projectId"
              >
                Project
                <NativeSelect
                  className="w-full"
                  id="focus-period-follow-up-projectId"
                  name={field.name}
                  onChange={(event) =>
                    editDraft(() => field.handleChange(event.target.value))
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Select Project
                  </NativeSelectOption>
                  {projects.map((project) => (
                    <NativeSelectOption key={project.id} value={project.id}>
                      {project.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
          </form.Field>
          <form.Field name="title">
            {(field) => (
              <label
                className="flex flex-col gap-1"
                htmlFor="focus-period-follow-up-title"
              >
                Title
                <Input
                  id="focus-period-follow-up-title"
                  maxLength={255}
                  name={field.name}
                  onChange={(event) =>
                    editDraft(() => field.handleChange(event.target.value))
                  }
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <label
                className="flex flex-col gap-1"
                htmlFor="focus-period-follow-up-description"
              >
                Description
                <Textarea
                  className="min-h-20"
                  id="focus-period-follow-up-description"
                  maxLength={100_000}
                  name={field.name}
                  onChange={(event) =>
                    editDraft(() => field.handleChange(event.target.value))
                  }
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <Button
            disabled={
              submitting || !(learningText.trim() && projectId && title.trim())
            }
            type="submit"
            variant="outline"
          >
            Preview Follow-up Work
          </Button>
        </form>
        {learningText.trim() ? null : (
          <p className="text-sm text-muted-foreground">
            Save a {learning} learning before creating Follow-up Work.
          </p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        {previewed ? (
          <section
            aria-label="Follow-up Work preview"
            className="space-y-3 rounded-md border p-4"
          >
            <h4 className="font-semibold">Follow-up Work preview</h4>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Title</dt>
                <dd>{title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd>
                  {projects.find((item) => item.id === projectId)?.name ?? ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Learning</dt>
                <dd>
                  {learning}: {learningText}
                </dd>
              </div>
              {description.trim() ? (
                <div>
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{description}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Source Focus Period</dt>
                <dd>{period.purpose}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={submitting}
                onClick={() =>
                  submitForm(form, { action: "confirm" }).catch(() => undefined)
                }
                type="button"
              >
                Confirm
              </Button>
              <Button
                disabled={submitting}
                onClick={() => form.setFieldValue("previewed", false)}
                type="button"
                variant="outline"
              >
                Change
              </Button>
            </div>
          </section>
        ) : null}
      </section>
      <section aria-label="Follow-up Work" className="space-y-2">
        <h3 className="font-semibold">Created Follow-up Work</h3>
        {period.followUpWorks.length ? (
          <ul className="space-y-2">
            {period.followUpWorks.map((item) => (
              <li className="rounded-md border px-3 py-2" key={item.id}>
                <Link
                  aria-label={`Open source record: ${item.key} ${item.title}`}
                  hash={workRecordHash(item.id)}
                  params={{ projectId: item.projectId }}
                  to="/projects/$projectId"
                >
                  {item.title} · {item.key} · {item.projectName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.learning}: {item.learningText}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Follow-up Work linked to this Focus Period.
          </p>
        )}
      </section>
    </>
  );
}
