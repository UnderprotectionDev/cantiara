// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  configureProjectUpdateReminderInputSchema,
  PROJECT_UPDATE_REMINDER_INTERVAL_LABEL,
  PROJECT_UPDATE_REMINDER_INTERVAL_MAX_DAYS,
  PROJECT_UPDATE_REMINDER_LABEL,
  PROJECT_UPDATE_REMINDER_QUESTION_LABEL,
  PROJECT_UPDATE_REMINDER_QUESTION_MAX,
  PROJECT_UPDATE_REMINDER_STATES,
  type ProjectUpdateReminder,
  type ProjectUpdateReminderState,
  SAVE_PROJECT_UPDATE_REMINDER_LABEL,
  SKIP_PROJECT_UPDATE_REMINDER_LABEL,
} from "@cantiara/api/project-updates";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

export interface ProjectUpdateReminderControls {
  onConfigure: (values: {
    intervalDays: number;
    question: string;
    state: ProjectUpdateReminderState;
  }) => Promise<unknown>;
  onSkip: () => Promise<unknown>;
  reminder: ProjectUpdateReminder;
}

/**
 * The optional repeating reminder of one Project. A due reminder shows the
 * founder's reflection question above the existing form and can be skipped,
 * which writes nothing; only the form's own save creates a Project Update.
 * Nothing here is required, and nothing is judged from elapsed time.
 */
const reminderFormSchema = configureProjectUpdateReminderInputSchema.omit({
  projectId: true,
});

export function ProjectUpdateReminderForm({
  onConfigure,
  onSkip,
  reminder,
}: ProjectUpdateReminderControls) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      intervalDays: String(reminder.intervalDays),
      question: reminder.question,
      state: reminder.state,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = reminderFormSchema.safeParse({
        intervalDays: Number(value.intervalDays),
        question: value.question,
        state: value.state,
      });
      if (!parsed.success) {
        setError("Write a question and an interval of 1 to 365 days.");
        return;
      }
      try {
        await onConfigure(parsed.data);
      } catch {
        setError("The reminder could not be saved. Retry.");
      }
    },
  });

  async function skip() {
    setError(null);
    try {
      await onSkip();
    } catch {
      setError("The reminder could not be skipped. Retry.");
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <section
      aria-label={PROJECT_UPDATE_REMINDER_LABEL}
      className="space-y-3"
      id="project-update-reminder"
    >
      <h3 className="font-medium">{PROJECT_UPDATE_REMINDER_LABEL}</h3>
      {reminder.due ? (
        <div className="space-y-2" role="status">
          <p className="text-sm">{reminder.question}</p>
          <Button
            onClick={() => {
              skip().catch(() => undefined);
            }}
            type="button"
            variant="outline"
          >
            {SKIP_PROJECT_UPDATE_REMINDER_LABEL}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form
        aria-label={PROJECT_UPDATE_REMINDER_LABEL}
        className="grid gap-3"
        onSubmit={submit}
      >
        <form.Field name="state">
          {(field) => (
            <fieldset className="grid gap-2">
              <legend className="text-sm">Reminder</legend>
              <RadioGroup
                className="flex w-auto flex-wrap gap-4"
                name="project-update-reminder-state"
                onValueChange={(next) => {
                  const option = PROJECT_UPDATE_REMINDER_STATES.find(
                    (candidate) => candidate === next,
                  );
                  if (option) {
                    field.handleChange(option);
                  }
                }}
                value={field.state.value}
              >
                {PROJECT_UPDATE_REMINDER_STATES.map((option) => (
                  <label
                    className="inline-flex items-center gap-2 text-sm"
                    htmlFor={`project-update-reminder-${option.toLowerCase()}`}
                    key={option}
                  >
                    <RadioGroupItem
                      id={`project-update-reminder-${option.toLowerCase()}`}
                      value={option}
                    />
                    {option}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
        </form.Field>
        <form.Field name="question">
          {(field) => (
            <label
              className="grid gap-2 text-sm"
              htmlFor="project-update-reminder-question"
            >
              {PROJECT_UPDATE_REMINDER_QUESTION_LABEL}
              <Input
                id="project-update-reminder-question"
                maxLength={PROJECT_UPDATE_REMINDER_QUESTION_MAX}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="intervalDays">
          {(field) => (
            <label
              className="grid gap-2 text-sm"
              htmlFor="project-update-reminder-interval"
            >
              {PROJECT_UPDATE_REMINDER_INTERVAL_LABEL}
              <Input
                id="project-update-reminder-interval"
                max={PROJECT_UPDATE_REMINDER_INTERVAL_MAX_DAYS}
                min={1}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                type="number"
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <p className="text-muted-foreground text-sm">
          Optional. A reminder only opens this form; skipping it saves nothing.
        </p>
        <Button type="submit" variant="outline">
          {SAVE_PROJECT_UPDATE_REMINDER_LABEL}
        </Button>
      </form>
    </section>
  );
}
