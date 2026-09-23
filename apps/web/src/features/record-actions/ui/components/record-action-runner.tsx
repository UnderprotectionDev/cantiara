// biome-ignore-all lint/performance/noJsxPropsBind: Runner controls capture the selected Work and action to submit that exact command.
import {
  RECORD_ACTION_CUSTOM_FIELD_CHANGE_KEY_PREFIX,
  type RecordAction,
  type RecordActionMutationValue,
  type RecordActionPreview,
} from "@cantiara/api/record-actions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";

import type { RecordActionRunnerState } from "../../hooks/use-record-action-runner";

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
