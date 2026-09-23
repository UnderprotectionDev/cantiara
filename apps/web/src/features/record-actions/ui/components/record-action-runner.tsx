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
  type RecordActionRuntimeInputs,
} from "@cantiara/api/record-actions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Dialog,
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
import { useEffect, useRef, useState } from "react";

import type { RecordActionRunnerState } from "../../hooks/use-record-action-runner";

interface RuntimeInputDraft {
  customFieldValues: Record<string, ParsedCustomFieldValuePayload | undefined>;
  relations: Record<string, string | undefined>;
}

const EMPTY_RUNTIME_INPUT_DRAFT: RuntimeInputDraft = {
  customFieldValues: {},
  relations: {},
};

function runtimeInputsFromDraft(
  action: RecordAction,
  draft: RuntimeInputDraft,
): RecordActionRuntimeInputs | null {
  const customFieldValues: Record<string, ParsedCustomFieldValuePayload> = {};
  const relations: Record<string, { recordId: string; recordType: "Work" }> =
    {};
  for (const step of action.steps) {
    if (
      step.kind === "custom-field-value" &&
      step.value.kind === "runtime-input"
    ) {
      const value = draft.customFieldValues[step.definitionId];
      if (!value) {
        return null;
      }
      customFieldValues[step.definitionId] = value;
    } else if (step.kind === "related-work") {
      const recordId = draft.relations[step.inputId];
      if (!recordId) {
        return null;
      }
      relations[step.inputId] = { recordId, recordType: "Work" };
    }
  }
  return { customFieldValues, relations };
}

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
      <Input
        aria-label={definition.name}
        disabled={disabled}
        id={id}
        onChange={(event) =>
          onChange(
            event.target.value
              ? { date: event.target.value, kind: "date" }
              : undefined,
          )
        }
        type="date"
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
  onStart,
  work,
}: {
  actions: readonly RecordAction[];
  disabled: boolean;
  onStart: (action: RecordAction, work: WorkProfile) => void;
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
          disabled={disabled}
          key={action.id}
          onClick={() => onStart(action, work)}
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
      <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
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
          <span className="font-medium text-muted-foreground text-xs">
            {change.label}
          </span>
          <span className="break-words text-sm">
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
      <h3 className="mb-2 font-medium text-sm">Current value</h3>
      <ul className="space-y-2">
        {preview.changes.map((change) => (
          <li className="flex flex-col gap-1 text-sm" key={change.key}>
            <span className="font-medium text-muted-foreground text-xs">
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

function RecordActionRuntimeInputForm({
  active,
  draft,
  onDraftChange,
  runner,
}: {
  active: NonNullable<RecordActionRunnerState["active"]>;
  draft: RuntimeInputDraft;
  onDraftChange: (draft: RuntimeInputDraft) => void;
  runner: RecordActionRunnerState;
}) {
  const customFieldSteps = active.action.steps.filter(
    (step) =>
      step.kind === "custom-field-value" && step.value.kind === "runtime-input",
  );
  const relatedWorkSteps = active.action.steps.filter(
    (step) => step.kind === "related-work",
  );
  const runtimeInputs = runtimeInputsFromDraft(active.action, draft);
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
      onSubmit={(event) => {
        event.preventDefault();
        if (runtimeInputs) {
          runner.previewWithInputs(runtimeInputs);
        }
      }}
    >
      <h3 className="font-medium text-sm">Runtime inputs</h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading input choices…
        </p>
      ) : null}
      {isUnavailable ? (
        <p className="text-destructive text-sm" role="alert">
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
              className="text-destructive text-sm"
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
            <RuntimeCustomFieldControl
              definition={definition}
              disabled={runner.isPreviewing || isLoading || isUnavailable}
              id={`record-action-input-${step.definitionId}`}
              onChange={(value) =>
                onDraftChange({
                  ...draft,
                  customFieldValues: {
                    ...draft.customFieldValues,
                    [step.definitionId]: value,
                  },
                })
              }
              value={draft.customFieldValues[step.definitionId]}
            />
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
            <NativeSelect
              disabled={
                runner.isPreviewing ||
                isLoading ||
                isUnavailable ||
                availableWorks.length === 0
              }
              id={`record-action-input-${step.inputId}`}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  relations: {
                    ...draft.relations,
                    [step.inputId]: event.target.value || undefined,
                  },
                })
              }
              value={draft.relations[step.inputId] ?? ""}
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
            {availableWorks.length === 0 && !isLoading ? (
              <p className="text-muted-foreground text-xs">
                No other Work records are available in this Project.
              </p>
            ) : null}
          </Field>
        );
      })}
      <Button
        disabled={
          !runtimeInputs || runner.isPreviewing || isLoading || isUnavailable
        }
        type="submit"
      >
        {runner.isPreviewing ? "Preparing preview…" : "Preview changes"}
      </Button>
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
      <h3 className="mb-2 font-medium text-sm">Inputs selected</h3>
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
          onClick={() => runner.start(active.action, active.work)}
          type="button"
        >
          Start again
        </Button>
      ) : null}
      {isCommitted && !runner.undoReceipt ? (
        <Button
          disabled={isFinalizing || active.work.archivedAt !== null}
          onClick={runner.undo}
          type="button"
          variant="outline"
        >
          {runner.undoError ? "Retry" : "Undo"}
        </Button>
      ) : null}
      {isFinalizing || isCommitted || isRolledBack ? null : (
        <Button onClick={runner.close} type="button" variant="outline">
          Cancel
        </Button>
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
      {canClose ? (
        <Button onClick={runner.close} type="button">
          Close
        </Button>
      ) : null}
    </DialogFooter>
  );
}

export function RecordActionRunDialog({
  runner,
}: {
  runner: RecordActionRunnerState;
}) {
  const [runtimeInputDraft, setRuntimeInputDraft] = useState<RuntimeInputDraft>(
    EMPTY_RUNTIME_INPUT_DRAFT,
  );
  const runVersionRef = useRef(runner.runVersion);
  useEffect(() => {
    if (runVersionRef.current === runner.runVersion) {
      return;
    }
    runVersionRef.current = runner.runVersion;
    setRuntimeInputDraft(EMPTY_RUNTIME_INPUT_DRAFT);
  }, [runner.runVersion]);
  const {
    active,
    error,
    isApplying,
    isPreviewing,
    isPreparingUndo,
    isUndoing,
    preview,
  } = runner;
  if (!active) {
    return null;
  }

  const isFinalizing = isApplying || (isUndoing && !isPreparingUndo);
  const isCommitted = runner.applyResult?.status === "committed";
  const currentValue =
    runner.applyResult?.status === "rolled-back" &&
    runner.applyResult.receipt.reason === "stale-base-revision"
      ? runner.applyResult.receipt.current
      : null;
  const statusMessage = actionStatusMessage(runner, active.action.name);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || isFinalizing || isPreparingUndo)) {
          runner.close();
        }
      }}
      open
    >
      <DialogContent
        aria-label={`Preview ${active.action.name}`}
        className="max-h-[min(80vh,40rem)] overflow-y-auto sm:max-w-lg"
        showCloseButton={!(isFinalizing || isPreparingUndo || isCommitted)}
      >
        <DialogHeader>
          <DialogTitle>Preview {active.action.name}</DialogTitle>
          <DialogDescription>
            {active.work.key} · {active.work.title}
          </DialogDescription>
        </DialogHeader>

        {isPreviewing ? (
          <p className="text-muted-foreground text-sm" role="status">
            Preparing preview…
          </p>
        ) : null}
        {runner.needsRuntimeInput && !preview ? (
          <RecordActionRuntimeInputForm
            active={active}
            draft={runtimeInputDraft}
            onDraftChange={setRuntimeInputDraft}
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
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <RecordActionRunDialogFooter
          active={active}
          isCommitted={isCommitted}
          isFinalizing={isFinalizing || isPreparingUndo}
          runner={runner}
        />
      </DialogContent>
    </Dialog>
  );
}
