// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { TestReviewSession } from "@cantiara/api/test-review";
import {
  FOLLOW_UP_STARTING_STATUS,
  type FollowUpTargetInput,
  followUpTargetInputSchema,
  resultLabel,
  TEST_REVIEW_FOLLOW_UP_LABEL,
  type TestFollowUpPreview,
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
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { allItems } from "../../lib/test-review-signal-lines";
import type {
  TestReviewSignalActions,
  TestReviewSignalData,
} from "../../lib/test-review-signal-types";
import { errorText, usePanelFocus } from "../components/test-review-panel";

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
  const [preview, setPreview] = useState<TestFollowUpPreview | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const headingRef = usePanelFocus(preview !== null);
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
      await run(async () => {
        setPreview(await actions.previewFollowUp(value.selected, parsed.data));
      }, "The preview is unavailable.");
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const { mode, selected, workId } = values;
  const target = () => followUpTarget(values);

  function handlePreviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  async function run(work: () => Promise<void>, fallback: string) {
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    try {
      await work();
    } catch (caught) {
      setError(errorText(caught, fallback));
    } finally {
      setPending(false);
    }
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
      <p className="text-muted-foreground text-sm">
        A Failed, Blocked or Inconclusive result creates no Bug, İş, Risk, Open
        Question, Decision, notification or priority by itself. Choose results,
        preview the target and origin, then confirm.
      </p>
      <form className="space-y-3" noValidate onSubmit={handlePreviewSubmit}>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Session Tests yet.</p>
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
                          setPreview(null);
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
                  setPreview(null);
                  field.handleChange(value === "existing" ? "existing" : "new");
                }}
                value={field.state.value}
              >
                <label
                  className="flex items-center gap-2"
                  htmlFor="test-review-follow-up-mode-new"
                >
                  <RadioGroupItem
                    id="test-review-follow-up-mode-new"
                    value="new"
                  />
                  New İş from one result
                </label>
                <label
                  className="flex items-center gap-2"
                  htmlFor="test-review-follow-up-mode-existing"
                >
                  <RadioGroupItem
                    id="test-review-follow-up-mode-existing"
                    value="existing"
                  />
                  Attach results to an existing İş
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
                      setPreview(null);
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
                      setPreview(null);
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
                Existing İş id or key
              </label>
              <form.Field name="workId">
                {(field) => (
                  <Input
                    disabled={disabled || pending}
                    id="test-review-follow-up-work"
                    name={field.name}
                    onChange={(event) => {
                      setPreview(null);
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
              <li>The İş keeps its own Origin; only the results are linked.</li>
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
            {`Nothing else is created (${FOLLOW_UP_STARTING_STATUS} status, no Bug, Risk, Test Gap, notification or priority). Closing the İş never changes these results; verifying a fix needs a new Test Session and, if you choose, Supersedes.`}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={disabled || pending}
              onClick={() =>
                run(async () => {
                  await actions.commitFollowUp(selected, target(), preview);
                  setPreview(null);
                  form.setFieldValue("selected", []);
                  setNotice("Follow-up work saved.");
                }, "The follow-up work was not saved.")
              }
              type="button"
            >
              {TEST_REVIEW_FOLLOW_UP_LABEL}
            </Button>
            <Button
              disabled={pending}
              onClick={() => setPreview(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {followUps.length > 0 ? (
        <ul aria-label="Follow-up links" className="text-sm">
          {followUps.map((link) => {
            const item = sessions
              .flatMap((session) => session.items)
              .find(({ id }) => id === link.sessionTestId);
            return (
              <li key={link.id}>
                {`${item?.title ?? link.sessionTestId}: ${link.mode} ${link.workKey ?? "unavailable İş"}${link.workTitle ? ` ${link.workTitle}` : ""}${link.workStatus ? ` (${link.workStatus})` : ""}`}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
