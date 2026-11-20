// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { TestReviewSession } from "@cantiara/api/test-review";
import {
  FOLLOW_UP_STARTING_STATUS,
  type FollowUpTargetInput,
  followUpTargetInputSchema,
  resultLabel,
  TEST_REVIEW_FOLLOW_UP_LABEL,
  WORK_FOLLOW_UP_TYPES,
} from "@cantiara/api/test-review-signals";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type SubmitEvent, useEffect } from "react";
import { orpc } from "@/utils/orpc";
import { usePanelFocus } from "../../hooks/use-panel-focus";
import { errorText } from "../../lib/test-review-panel";
import { allItems } from "../../lib/test-review-signal-lines";
import type {
  TestReviewSignalActions,
  TestReviewSignalData,
} from "../../lib/test-review-signal-types";

interface FollowUpFormValues {
  mode: "existing" | "new";
  title: string;
  workId: string;
  workType: (typeof WORK_FOLLOW_UP_TYPES)[number];
}

function followUpTarget(
  value: FollowUpFormValues & { selected: string[] },
): FollowUpTargetInput {
  return value.mode === "new"
    ? {
        mode: "new",
        ...(value.title.trim() ? { title: value.title.trim() } : {}),
        workType: value.workType,
      }
    : { mode: "existing", workId: value.workId.trim() };
}

export default function TestReviewFollowUpForm({
  actions,
  disabled,
  followUps,
  preferences,
  sessions,
}: {
  actions: TestReviewSignalActions;
  disabled: boolean;
  followUps: TestReviewSignalData["followUps"];
  preferences?: AccountPreferences;
  sessions: TestReviewSession[];
}) {
  const items = allItems(sessions, preferences);
  const commit = actions.followUpState;
  const inspect = useMutation({
    mutationKey: orpc.previewReviewFollowUp.mutationKey(),
    mutationFn: ({
      selected: reviewed,
      target,
    }: {
      selected: string[];
      target: FollowUpTargetInput;
    }) => actions.previewFollowUp(reviewed, target),
    meta: { retryInSurface: true },
  });
  const preview = commit?.isSuccess ? undefined : inspect.data;
  const pending = inspect.isPending || commit?.isPending;
  const headingRef = usePanelFocus(Boolean(preview));

  function resetReview() {
    inspect.reset();
    commit?.reset();
  }

  const form = useForm({
    defaultValues: {
      mode: "new" as FollowUpFormValues["mode"],
      selected: [] as string[],
      title: "",
      workId: "",
      workType: "Task" as FollowUpFormValues["workType"],
    },
    onSubmit: async ({ value }) => {
      const parsed = followUpTargetInputSchema.safeParse(followUpTarget(value));
      if (!parsed.success || value.selected.length === 0) {
        return;
      }
      commit?.reset();
      await inspect.mutateAsync({
        selected: value.selected,
        target: parsed.data,
      });
    },
  });
  const values = useSelector(form.store, (state) => state.values);
  const { mode, selected, workId } = values;
  const saved = commit?.isSuccess;
  useEffect(() => {
    if (saved) {
      form.setFieldValue("selected", []);
    }
  }, [form, saved]);

  function handlePreviewSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  async function confirm() {
    if (!(preview && inspect.variables)) {
      return;
    }
    const { selected: reviewed, target } = inspect.variables;
    await actions.commitFollowUp(reviewed, target, preview);
    inspect.reset();
  }

  const needsOne = mode === "new" && selected.length !== 1;
  const missingWork = mode === "existing" && !workId.trim();

  return (
    <section
      aria-labelledby="test-review-follow-up-heading"
      className="space-y-3"
    >
      <h3 className="font-medium" id="test-review-follow-up-heading">
        {TEST_REVIEW_FOLLOW_UP_LABEL}
      </h3>
      <p className="text-sm text-muted-foreground">
        A Failed, Blocked or Inconclusive result creates no Bug, Work, Risk,
        Open Question, Decision, notification or priority by itself. Choose
        results, preview the target and origin, then confirm.
      </p>
      <form className="space-y-3" noValidate onSubmit={handlePreviewSubmit}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Session Tests yet.</p>
        ) : (
          <fieldset className="m-0 min-w-0 space-y-1 border-0 p-0 text-sm">
            <legend className="font-medium">Results for follow-up</legend>
            <form.Field name="selected">
              {(field) => (
                <>
                  {items.map((item) => (
                    <label
                      className="flex items-center gap-2"
                      htmlFor={`test-review-follow-up-result-${item.id}`}
                      key={item.id}
                    >
                      <Checkbox
                        checked={field.state.value.includes(item.id)}
                        disabled={disabled || pending}
                        id={`test-review-follow-up-result-${item.id}`}
                        onCheckedChange={() => {
                          resetReview();
                          field.handleChange((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          );
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                </>
              )}
            </form.Field>
          </fieldset>
        )}
        <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0 text-sm">
          <legend className="font-medium">Target</legend>
          <form.Field name="mode">
            {(field) => (
              <RadioGroup
                name="test-review-follow-up-mode"
                onValueChange={(value) => {
                  resetReview();
                  field.handleChange(value === "existing" ? "existing" : "new");
                }}
                value={field.state.value}
              >
                <label
                  className="flex items-center gap-2"
                  htmlFor="test-review-follow-up-mode-new"
                >
                  <RadioGroupItem
                    disabled={disabled || pending}
                    id="test-review-follow-up-mode-new"
                    value="new"
                  />
                  New Work from one result
                </label>
                <label
                  className="flex items-center gap-2"
                  htmlFor="test-review-follow-up-mode-existing"
                >
                  <RadioGroupItem
                    disabled={disabled || pending}
                    id="test-review-follow-up-mode-existing"
                    value="existing"
                  />
                  Attach results to an existing Work
                </label>
              </RadioGroup>
            )}
          </form.Field>
          {mode === "new" ? (
            <div className="grid gap-2">
              <label htmlFor="test-review-follow-up-title">
                Title (optional)
              </label>
              <form.Field name="title">
                {(field) => (
                  <Input
                    disabled={disabled || pending}
                    id="test-review-follow-up-title"
                    name={field.name}
                    onChange={(event) => {
                      resetReview();
                      field.handleChange(event.target.value);
                    }}
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <label htmlFor="test-review-follow-up-type">Work type</label>
              <form.Field name="workType">
                {(field) => (
                  <NativeSelect
                    disabled={disabled || pending}
                    id="test-review-follow-up-type"
                    name={field.name}
                    onChange={(event) => {
                      resetReview();
                      field.handleChange(
                        event.target
                          .value as (typeof WORK_FOLLOW_UP_TYPES)[number],
                      );
                    }}
                    value={field.state.value}
                  >
                    {WORK_FOLLOW_UP_TYPES.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </form.Field>
            </div>
          ) : (
            <div className="grid gap-2">
              <label htmlFor="test-review-follow-up-work">
                Existing Work id or key
              </label>
              <form.Field name="workId">
                {(field) => (
                  <Input
                    disabled={disabled || pending}
                    id="test-review-follow-up-work"
                    name={field.name}
                    onChange={(event) => {
                      resetReview();
                      field.handleChange(event.target.value);
                    }}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </div>
          )}
        </fieldset>
        <Button
          disabled={
            disabled ||
            pending ||
            selected.length === 0 ||
            needsOne ||
            missingWork
          }
          type="submit"
          variant="outline"
        >
          {`Preview: ${TEST_REVIEW_FOLLOW_UP_LABEL}`}
        </Button>
      </form>
      {preview ? (
        <section
          aria-labelledby="test-review-follow-up-preview-heading"
          className="space-y-2 rounded-md border border-border p-3 text-sm"
        >
          <h4
            className="font-medium outline-none"
            id="test-review-follow-up-preview-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            {`Preview: ${TEST_REVIEW_FOLLOW_UP_LABEL}`}
          </h4>
          {preview.plan.target.mode === "new" ? (
            <ul aria-label="Follow-up work preview" className="list-disc pl-5">
              <li>{`Target: new ${preview.plan.target.work.type} in Project ${preview.plan.target.project.name}`}</li>
              <li>{`Title: ${preview.plan.target.work.title}`}</li>
              <li>{`Starting status: ${preview.plan.target.work.startingStatus}`}</li>
              <li>{`Originates from: Test Session ${preview.plan.originatesFrom?.label ?? ""}`}</li>
              <li>{`Origin Location: Session Test ${preview.plan.originLocation?.title ?? ""} (immutable)`}</li>
            </ul>
          ) : (
            <ul aria-label="Follow-up work preview" className="list-disc pl-5">
              <li>{`Target: existing ${preview.plan.target.work.key} ${preview.plan.target.work.title} (${preview.plan.target.work.status})`}</li>
              <li>
                The Work keeps its own Origin; only the results are linked.
              </li>
            </ul>
          )}
          <ul aria-label="Results to link" className="list-disc pl-5">
            {preview.plan.results.map((result) => (
              <li key={result.sessionTestId}>
                {`${result.title}: ${result.normalizedResult ? resultLabel(result.normalizedResult) : "Not reported"}`}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            {`Nothing else is created (${FOLLOW_UP_STARTING_STATUS} status, no Bug, Risk, Test Gap, notification or priority). Closing the Work never changes these results; verifying a fix needs a new Test Session and, if you choose, Supersedes.`}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={disabled || pending}
              onClick={() => confirm().catch(() => undefined)}
              type="button"
            >
              {TEST_REVIEW_FOLLOW_UP_LABEL}
            </Button>
            <Button
              disabled={pending}
              onClick={resetReview}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
      {inspect.error ? (
        <p role="alert">
          {errorText(inspect.error, "The preview is unavailable.")}
        </p>
      ) : null}
      {commit?.error ? (
        <p role="alert">
          {errorText(commit.error, "The follow-up work was not saved.")}
        </p>
      ) : null}
      {commit?.isSuccess ? <p role="status">Follow-up work saved.</p> : null}
      {followUps.length > 0 ? (
        <ul aria-label="Follow-up links" className="text-sm">
          {followUps.map((link) => {
            const item = sessions
              .flatMap((session) => session.items)
              .find(({ id }) => id === link.sessionTestId);
            return (
              <li key={link.id}>
                {`${item?.title ?? link.sessionTestId}: ${link.mode} ${link.workKey ?? "unavailable Work"}${link.workTitle ? ` ${link.workTitle}` : ""}${link.workStatus ? ` (${link.workStatus})` : ""}`}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
