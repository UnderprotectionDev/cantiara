// biome-ignore-all lint/performance/noJsxPropsBind: Runner controls capture the selected Work and action to submit that exact command.

import type {
  CustomFieldDefinition,
  ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import {
  RECORD_ACTION_CUSTOM_FIELD_CHANGE_KEY_PREFIX,
  type RecordAction,
  type RecordActionMutationValue,
  type RecordActionPreview,
} from "@cantiara/api/record-actions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  type createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useId } from "react";
import { DatePicker } from "@/components/date-picker";
import { isPopupCommandPending } from "@/lib/is-popup-command-pending";
import {
  type RecordActionRunnerState,
  useRecordActionRunner,
} from "../../hooks/use-record-action-runner";
import { useRecordActionRuntimeInputForm } from "../../hooks/use-record-action-runtime-input-form";
import type {
  ActiveRecordAction,
  RecordActionDialogPayload,
} from "../../lib/record-action-run";
import { recordActionRuntimeInputsFormSchema } from "../../lib/record-action-runtime-inputs";

function RuntimeCustomFieldControl({
  definition,
  disabled,
  id,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  id: string;
  onChange: (value: ParsedCustomFieldValuePayload | undefined) => void;
  value?: ParsedCustomFieldValuePayload;
}) {
  if (definition.type === "Date") {
    return (
      <DatePicker
        ariaLabel={definition.name}
        disabled={disabled}
        id={id}
        onChange={(next) =>
          onChange(next ? { date: next, kind: "date" } : undefined)
        }
        value={value?.kind === "date" ? value.date : ""}
      />
    );
  }
  if (definition.type === "Number") {
    return (
      <Input
        aria-label={definition.name}
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const number = Number(event.target.value);
          onChange(
            event.target.value && Number.isFinite(number)
              ? { kind: "number", number }
              : undefined,
          );
        }}
        step="any"
        type="number"
        value={value?.kind === "number" ? value.number : ""}
      />
    );
  }
  if (definition.type === "Single select") {
    return (
      <NativeSelect
        aria-label={definition.name}
        disabled={disabled}
        id={id}
        onChange={(event) =>
          onChange(
            event.target.value
              ? { kind: "option", option: event.target.value }
              : undefined,
          )
        }
        value={value?.kind === "option" ? value.option : ""}
      >
        <NativeSelectOption value="">Choose a value</NativeSelectOption>
        {definition.options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  if (definition.type === "Multi select") {
    const selected = value?.kind === "options" ? value.options : [];
    return (
      <div className="flex flex-wrap gap-3">
        {definition.options.map((option, index) => {
          const optionId =
            index === 0
              ? id
              : `record-action-runtime-${definition.id}-${index}`;
          return (
            <label
              className="flex items-center gap-2 text-xs"
              htmlFor={optionId}
              key={option}
            >
              <Checkbox
                checked={selected.includes(option)}
                disabled={disabled}
                id={optionId}
                onCheckedChange={(checked) => {
                  const options = checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option);
                  onChange(
                    options.length > 0
                      ? { kind: "options", options }
                      : undefined,
                  );
                }}
              />
              {option}
            </label>
          );
        })}
      </div>
    );
  }
  return null;
}

export function RecordActionButtons({
  actions,
  disabled,
  handle,
  work,
}: {
  actions: readonly RecordAction[];
  disabled: boolean;
  handle: ReturnType<typeof createDialogHandle<RecordActionDialogPayload>>;
  work: WorkProfile;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <fieldset
      aria-label={`Record Actions for ${work.key}`}
      className="flex flex-wrap items-center gap-2 border-0 p-0"
    >
      <legend className="sr-only">Record Actions for {work.key}</legend>
      {actions.map((action) => (
        <Button
          aria-haspopup="dialog"
          disabled={disabled}
          key={action.id}
          onClick={(event) =>
            handle.openWithPayload({
              action,
              trigger: event.currentTarget,
              work,
            })
          }
          size="xs"
          type="button"
          variant="outline"
        >
          {action.name}
        </Button>
      ))}
    </fieldset>
  );
}

function formatChangeValue(
  value: RecordActionPreview["changes"][number]["before"],
  key: string,
) {
  if (key === "daily-focus-membership" && typeof value === "boolean") {
    return value ? "In Daily Focus" : "Not in Daily Focus";
  }
  if (key.startsWith("relation:") && typeof value === "boolean") {
    return value ? "Related" : "Not related";
  }
  if (value === null) {
    return "Empty";
  }
  if (typeof value !== "object") {
    return String(value);
  }

  switch (value.kind) {
    case "boolean":
      return value.boolean ? "On" : "Off";
    case "date":
      return value.date;
    case "number":
      return String(value.number);
    case "option":
      return value.option;
    case "options":
      return value.options.join(", ") || "Empty";
    case "text":
      return value.text || "Empty";
    default:
      return "Empty";
  }
}

function RecordActionChangeList({ preview }: { preview: RecordActionPreview }) {
  if (preview.changes.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No fields will change.
      </p>
    );
  }

  return (
    <ul aria-label="Changes" className="divide-y border-y">
      {preview.changes.map((change) => (
        <li
          className="grid gap-1 py-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)] sm:gap-4"
          key={change.key}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {change.label}
          </span>
          <span className="text-sm break-words">
            {formatChangeValue(change.before, change.key)} →{" "}
            {formatChangeValue(change.after, change.key)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function currentValueForChange(
  change: RecordActionPreview["changes"][number],
  value: RecordActionMutationValue,
) {
  switch (change.key) {
    case "status":
      return value.status ?? null;
    case "closure-result":
      return value.closureResult ?? null;
    case "closure-reason":
      return value.closureReason ?? null;
    case "daily-focus-membership":
      return value.dailyFocus?.included ?? false;
    default:
      if (change.key.startsWith("relation:")) {
        return value.relatedWork?.included ?? false;
      }
      return (
        value.customFields?.[
          change.key.slice(RECORD_ACTION_CUSTOM_FIELD_CHANGE_KEY_PREFIX.length)
        ] ?? null
      );
  }
}

function RecordActionCurrentValue({
  current,
  preview,
}: {
  current: { value: RecordActionMutationValue };
  preview: RecordActionPreview;
}) {
  return (
    <section aria-label="Current value" className="rounded-md border p-3">
      <h3 className="mb-2 text-sm font-medium">Current value</h3>
      <ul className="space-y-2">
        {preview.changes.map((change) => (
          <li className="flex flex-col gap-1 text-sm" key={change.key}>
            <span className="text-xs font-medium text-muted-foreground">
              {change.label}
            </span>
            <span>
              {formatChangeValue(
                currentValueForChange(change, current.value),
                change.key,
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type RuntimeInputForm = ReturnType<typeof useRecordActionRuntimeInputForm>;

function RecordActionRuntimeInputForm({
  active,
  form,
  runner,
}: {
  active: NonNullable<RecordActionRunnerState["active"]>;
  form: RuntimeInputForm;
  runner: RecordActionRunnerState;
}) {
  const customFieldSteps = active.action.steps.filter(
    (step) =>
      step.kind === "custom-field-value" && step.value.kind === "runtime-input",
  );
  const relatedWorkSteps = active.action.steps.filter(
    (step) => step.kind === "related-work",
  );
  const runtimeInputsSchema = recordActionRuntimeInputsFormSchema(
    active.action,
  );
  const availableWorks = runner.runtimeWorks.filter(
    (work) => work.id !== active.work.id,
  );
  const isLoading =
    (customFieldSteps.length > 0 && runner.runtimeCustomFieldsPending) ||
    (relatedWorkSteps.length > 0 && runner.runtimeWorksPending);
  const isUnavailable =
    (customFieldSteps.length > 0 && runner.runtimeCustomFieldsError) ||
    (relatedWorkSteps.length > 0 && runner.runtimeWorksError);

  return (
    <form
      aria-label="Record Action inputs"
      className="space-y-4 rounded-md border p-3"
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="text-sm font-medium">Runtime inputs</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading input choices…
        </p>
      ) : null}
      {isUnavailable ? (
        <p className="text-sm text-destructive" role="alert">
          Runtime inputs could not be loaded. Try again.
        </p>
      ) : null}
      {customFieldSteps.map((step) => {
        if (step.kind !== "custom-field-value") {
          return null;
        }
        const definition = runner.runtimeCustomFields.find(
          (candidate) => candidate.id === step.definitionId,
        );
        if (!definition) {
          return (
            <p
              className="text-sm text-destructive"
              key={step.definitionId}
              role="alert"
            >
              A Custom field required by this Record Action is unavailable.
            </p>
          );
        }
        return (
          <Field key={step.definitionId}>
            <FieldLabel htmlFor={`record-action-input-${step.definitionId}`}>
              {definition.name}
            </FieldLabel>
            <form.Field name={`customFieldValues.${step.definitionId}`}>
              {(field) => (
                <RuntimeCustomFieldControl
                  definition={definition}
                  disabled={runner.isPreviewing || isLoading || isUnavailable}
                  id={`record-action-input-${step.definitionId}`}
                  onChange={(value) => field.handleChange(value)}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </Field>
        );
      })}
      {relatedWorkSteps.map((step) => {
        if (step.kind !== "related-work") {
          return null;
        }
        return (
          <Field key={step.inputId}>
            <FieldLabel htmlFor={`record-action-input-${step.inputId}`}>
              Related Work
            </FieldLabel>
            <form.Field name={`relations.${step.inputId}`}>
              {(field) => (
                <NativeSelect
                  disabled={
                    runner.isPreviewing ||
                    isLoading ||
                    isUnavailable ||
                    availableWorks.length === 0
                  }
                  id={`record-action-input-${step.inputId}`}
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(event.target.value || undefined)
                  }
                  value={field.state.value ?? ""}
                >
                  <NativeSelectOption value="">
                    Choose an existing Work
                  </NativeSelectOption>
                  {availableWorks.map((work) => (
                    <NativeSelectOption key={work.id} value={work.id}>
                      {work.key} · {work.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
            {availableWorks.length === 0 && !isLoading ? (
              <p className="text-xs text-muted-foreground">
                No other Work records are available in this Project.
              </p>
            ) : null}
          </Field>
        );
      })}
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <Button
            disabled={
              !runtimeInputsSchema.safeParse(values).success ||
              runner.isPreviewing ||
              isLoading ||
              isUnavailable
            }
            type="submit"
          >
            {runner.isPreviewing ? "Preparing preview…" : "Preview changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function RecordActionRuntimeInputSummary({
  preview,
  runner,
}: {
  preview: RecordActionPreview;
  runner: RecordActionRunnerState;
}) {
  const customInputs = Object.entries(preview.runtimeInputs.customFieldValues);
  const relationInputs = Object.entries(preview.runtimeInputs.relations);
  if (customInputs.length === 0 && relationInputs.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Runtime inputs selected"
      className="rounded-md border p-3"
    >
      <h3 className="mb-2 text-sm font-medium">Inputs selected</h3>
      <ul className="space-y-2 text-sm">
        {customInputs.map(([definitionId, value]) => (
          <li className="flex justify-between gap-3" key={definitionId}>
            <span className="font-medium text-muted-foreground">
              {runner.runtimeCustomFields.find(
                (definition) => definition.id === definitionId,
              )?.name ?? "Custom field"}
            </span>
            <span>{formatChangeValue(value, "runtime-input")}</span>
          </li>
        ))}
        {relationInputs.map(([inputId, endpoint]) => {
          const work = runner.runtimeWorks.find(
            (candidate) => candidate.id === endpoint.recordId,
          );
          return (
            <li className="flex justify-between gap-3" key={inputId}>
              <span className="font-medium text-muted-foreground">
                Related Work
              </span>
              <span className="text-right">
                {work ? `${work.key} · ${work.title}` : endpoint.recordId}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function actionStatusMessage(
  runner: RecordActionRunnerState,
  actionName: string,
) {
  if (runner.isApplying || (runner.isUndoing && !runner.isPreparingUndo)) {
    return "Finalizing";
  }
  if (runner.isPreparingUndo) {
    return "Preparing Undo…";
  }
  if (runner.undoReceipt) {
    return `${actionName} was undone.`;
  }
  if (runner.applyResult?.status === "committed") {
    return `${actionName} applied.`;
  }
  if (runner.applyResult?.status === "rolled-back") {
    if (runner.applyResult.receipt.reason === "stale-base-revision") {
      return `${actionName} was not applied. Work changed, and no changes were saved. Start again to review the current values.`;
    }
    return `${actionName} was not applied. No changes were saved.`;
  }
  return null;
}

function RecordActionRunDialogFooter({
  active,
  isFinalizing,
  isCommitted,
  runner,
}: {
  active: NonNullable<RecordActionRunnerState["active"]>;
  isFinalizing: boolean;
  isCommitted: boolean;
  runner: RecordActionRunnerState;
}) {
  const isRolledBack = runner.applyResult?.status === "rolled-back";
  const canApply = Boolean(
    !(isFinalizing || runner.applyResult) && runner.preview,
  );
  const canClose = Boolean(
    !isFinalizing && (runner.undoReceipt || isCommitted || isRolledBack),
  );

  return (
    <DialogFooter>
      {isRolledBack ? (
        <Button
          disabled={isFinalizing}
          onClick={runner.startAgain}
          type="button"
        >
          Start again
        </Button>
      ) : null}
      <RecordActionUndoButton
        active={active}
        isCommitted={isCommitted}
        isFinalizing={isFinalizing}
        runner={runner}
      />
      {isFinalizing || isCommitted || isRolledBack ? null : (
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
      )}
      {canApply ? (
        <Button
          disabled={
            runner.preview?.changes.length === 0 ||
            active.work.archivedAt !== null
          }
          onClick={runner.apply}
          type="button"
        >
          {runner.applyError ? "Retry" : "Apply"}
        </Button>
      ) : null}
      {canClose ? <DialogClose render={<Button />}>Close</DialogClose> : null}
    </DialogFooter>
  );
}

export function RecordActionRunDialog({
  handle,
  projectId,
}: {
  handle: ReturnType<typeof createDialogHandle<RecordActionDialogPayload>>;
  projectId: string;
}) {
  const popupId = useId();
  const queryClient = useQueryClient();
  return (
    <Dialog
      handle={handle}
      onOpenChange={(open, event) => {
        if (!open && isPopupCommandPending(queryClient, popupId)) {
          event.cancel();
        }
      }}
    >
      {({ payload }) =>
        payload ? (
          <DialogContent
            aria-label={`Preview ${payload.action.name}`}
            className="max-h-[min(80vh,40rem)] overflow-y-auto sm:max-w-lg"
            finalFocus={() =>
              payload.trigger.isConnected ? payload.trigger : true
            }
            showCloseButton={false}
          >
            <RecordActionRunContent
              key={`${payload.action.id}:${payload.work.id}`}
              openingAction={payload}
              popupId={popupId}
              projectId={projectId}
            />
          </DialogContent>
        ) : null
      }
    </Dialog>
  );
}

function RecordActionRunContent({
  popupId,
  openingAction,
  projectId,
}: {
  popupId: string;
  openingAction: ActiveRecordAction;
  projectId: string;
}) {
  const runner = useRecordActionRunner(projectId, openingAction, popupId);
  const runtimeInputForm = useRecordActionRuntimeInputForm(runner);
  const {
    active,
    error,
    isApplying,
    isPreviewing,
    isPreparingUndo,
    isUndoing,
    preview,
  } = runner;
  const isFinalizing = isApplying || (isUndoing && !isPreparingUndo);
  const isCommitted = runner.applyResult?.status === "committed";
  const currentValue =
    runner.applyResult?.status === "rolled-back" &&
    runner.applyResult.receipt.reason === "stale-base-revision"
      ? runner.applyResult.receipt.current
      : null;
  const statusMessage = actionStatusMessage(runner, active.action.name);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Preview {active.action.name}</DialogTitle>
        <DialogDescription>
          {active.work.key} · {active.work.title}
        </DialogDescription>
      </DialogHeader>

      <RecordActionPreviewContent
        active={active}
        currentValue={currentValue}
        error={error}
        isFinalizing={isFinalizing}
        isPreviewing={isPreviewing}
        preview={preview}
        runner={runner}
        runtimeInputForm={runtimeInputForm}
        statusMessage={statusMessage}
      />
      <RecordActionRunDialogFooter
        active={active}
        isCommitted={isCommitted}
        isFinalizing={isFinalizing || isPreparingUndo}
        runner={runner}
      />
    </>
  );
}

function RecordActionUndoButton({
  isCommitted,
  runner,
  isFinalizing,
  active,
}: {
  isCommitted: boolean;
  runner: RecordActionRunnerState;
  isFinalizing: boolean;
  active: NonNullable<RecordActionRunnerState["active"]>;
}) {
  return isCommitted && !runner.undoReceipt ? (
    <Button
      disabled={isFinalizing || active.work.archivedAt !== null}
      onClick={runner.undo}
      type="button"
      variant="outline"
    >
      {runner.undoError ? "Retry" : "Undo"}
    </Button>
  ) : null;
}

function RecordActionPreviewContent({
  isPreviewing,
  runner,
  preview,
  active,
  runtimeInputForm,
  isFinalizing,
  currentValue,
  statusMessage,
  error,
}: {
  isPreviewing: boolean;
  runner: RecordActionRunnerState;
  preview: RecordActionPreview | null;
  active: NonNullable<RecordActionRunnerState["active"]>;
  runtimeInputForm: RuntimeInputForm;
  isFinalizing: boolean;
  currentValue:
    | import("@cantiara/api/mutation-and-undo").MutationTarget<RecordActionMutationValue>
    | null
    | undefined;
  statusMessage: string | null;
  error: string | null;
}) {
  return (
    <>
      {" "}
      {isPreviewing ? (
        <p className="text-sm text-muted-foreground" role="status">
          Preparing preview…
        </p>
      ) : null}
      {runner.needsRuntimeInput && !preview ? (
        <RecordActionRuntimeInputForm
          active={active}
          form={runtimeInputForm}
          runner={runner}
        />
      ) : null}
      {preview ? (
        <RecordActionRuntimeInputSummary preview={preview} runner={runner} />
      ) : null}
      {preview && runner.needsRuntimeInput ? (
        <Button
          disabled={isFinalizing || runner.isPreviewing}
          onClick={runner.changeInputs}
          type="button"
          variant="outline"
        >
          Change inputs
        </Button>
      ) : null}
      {preview ? <RecordActionChangeList preview={preview} /> : null}
      {preview && currentValue ? (
        <RecordActionCurrentValue current={currentValue} preview={preview} />
      ) : null}
      {statusMessage ? (
        <p className="text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
