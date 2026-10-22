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
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
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
  const [clientIdempotencyKey, setClientIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [showPreview, setShowPreview] = useState(false);
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
    },
    onSubmit: () => {
      setShowPreview(true);
    },
  });
  const { description, learning, projectId, title } = useStore(
    form.store,
    (state) => state.values,
  );
  const learningText =
    period.evaluation?.[EVALUATION_FIELD_BY_LEARNING[learning]] ?? "";
  function editDraft(update: () => void) {
    update();
    setClientIdempotencyKey(crypto.randomUUID());
    setShowPreview(false);
  }
  async function confirm() {
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
      throw parsed.error;
    }
    await createFollowUp.mutateAsync(parsed.data);
    form.setFieldValue("title", "");
    form.setFieldValue("description", "");
    setShowPreview(false);
    setClientIdempotencyKey(crypto.randomUUID());
  }
  return (
    <>
      <section aria-label="Add follow-up Work" className="space-y-3">
        <h3 className="font-semibold">Add follow-up Work</h3>
        <p className="text-muted-foreground text-sm">
          Review the Work and its source learning before confirming. No Work is
          created until you confirm.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit().catch(() => undefined);
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
            disabled={!(learningText.trim() && projectId && title.trim())}
            type="submit"
            variant="outline"
          >
            Preview Follow-up Work
          </Button>
        </form>
        {learningText.trim() ? null : (
          <p className="text-muted-foreground text-sm">
            Save a {learning} learning before creating Follow-up Work.
          </p>
        )}
        {showPreview ? (
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
              <Button onClick={() => act(confirm)} type="button">
                Confirm
              </Button>
              <Button
                onClick={() => setShowPreview(false)}
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
                <p className="text-muted-foreground text-sm">
                  {item.learning}: {item.learningText}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No Follow-up Work linked to this Focus Period.
          </p>
        )}
      </section>
    </>
  );
}
