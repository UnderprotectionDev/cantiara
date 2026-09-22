// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current item state.

import type {
  WorkChecklistConversionPreview,
  WorkChecklistConversionResult,
  WorkChecklistItem,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { resolveChecklistDrafts } from "./work-checklist-items";

export default function WorkChecklist({
  checklist,
  disabled,
  onConfirmConvert,
  onPreviewConvert,
  onSave,
  workKey,
}: {
  checklist: WorkChecklistItem[];
  disabled: boolean;
  onConfirmConvert: (
    preview: WorkChecklistConversionPreview,
  ) => Promise<WorkChecklistConversionResult>;
  onPreviewConvert: (
    itemId: string,
  ) => Promise<WorkChecklistConversionPreview | null>;
  onSave: (checklist: WorkChecklistItem[]) => Promise<unknown>;
  workKey: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(checklist.map((item) => [item.id, item.text])),
  );
  const [conversionItemId, setConversionItemId] = useState<string | null>(null);
  const [conversionPending, setConversionPending] = useState(false);
  const [conversionPreview, setConversionPreview] =
    useState<WorkChecklistConversionPreview | null>(null);
  const resolvedChecklist = resolveChecklistDrafts(checklist, drafts);
  const completedCount = resolvedChecklist.filter(
    (item) => item.completed,
  ).length;

  // Every save sends the resolved list so pending text edits ride along with
  // any item action instead of being silently discarded by it. The parent owns
  // the error display; a failed save leaves local state untouched so typed
  // text is never lost.
  async function saveChecklist(nextChecklist: WorkChecklistItem[]) {
    try {
      await onSave(nextChecklist);
      return true;
    } catch {
      return false;
    }
  }

  const addItemForm = useForm({
    defaultValues: { newItem: "" },
    onSubmit: async ({ value }) => {
      const text = value.newItem.trim();
      if (!text) {
        return;
      }
      const saved = await saveChecklist([
        ...resolvedChecklist,
        { completed: false, id: crypto.randomUUID(), text },
      ]);
      if (saved) {
        addItemForm.reset();
      }
    },
  });

  function handleAddItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    addItemForm.handleSubmit().catch(() => undefined);
  }

  async function toggleItem(itemId: string, completed: boolean) {
    await saveChecklist(
      resolvedChecklist.map((item) =>
        item.id === itemId ? { ...item, completed } : item,
      ),
    );
  }

  async function moveItem(index: number, offset: -1 | 1) {
    const destination = index + offset;
    if (destination < 0 || destination >= resolvedChecklist.length) {
      return;
    }
    const reordered = [...resolvedChecklist];
    const [item] = reordered.splice(index, 1);
    if (!item) {
      return;
    }
    reordered.splice(destination, 0, item);
    await saveChecklist(reordered);
  }

  async function deleteItem(itemId: string) {
    await saveChecklist(resolvedChecklist.filter((item) => item.id !== itemId));
  }

  async function previewConversion(itemId: string) {
    setConversionItemId(itemId);
    setConversionPreview(null);
    setConversionPending(true);
    try {
      setConversionPreview(await onPreviewConvert(itemId));
    } catch {
      // The parent owns the mutation error display; leave the item ready for a
      // retry after the failed preview request.
    } finally {
      setConversionPending(false);
    }
  }

  async function confirmConversion() {
    if (!conversionPreview) {
      return;
    }
    setConversionPending(true);
    try {
      await onConfirmConvert(conversionPreview);
      setConversionItemId(null);
      setConversionPreview(null);
    } catch {
      // Keep the current preview so the user can retry the same command.
    } finally {
      setConversionPending(false);
    }
  }

  function cancelConversion() {
    setConversionItemId(null);
    setConversionPreview(null);
  }

  return (
    <section
      aria-label={`Checklist for ${workKey}`}
      className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-medium text-sm">Checklist</h4>
        {resolvedChecklist.length > 0 ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            {completedCount} of {resolvedChecklist.length} complete
          </p>
        ) : null}
      </div>
      {resolvedChecklist.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add the first small step for this Work.
        </p>
      ) : (
        <ol className="space-y-2">
          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Checklist item actions share one ordered save and conversion seam. */}
          {resolvedChecklist.map((item, index) => {
            const draft = drafts[item.id] ?? item.text;
            const conversionOpen = conversionItemId === item.id;
            return (
              <li className="flex flex-wrap items-center gap-2" key={item.id}>
                {item.convertedWork ? (
                  <p className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Work:</span>
                    <a
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      href={`#work-${encodeURIComponent(item.convertedWork.id)}`}
                    >
                      {item.convertedWork.key} — {item.convertedWork.title}
                    </a>
                  </p>
                ) : (
                  <>
                    <Checkbox
                      aria-label={`Mark ${item.text} ${
                        item.completed ? "incomplete" : "complete"
                      }`}
                      checked={item.completed}
                      disabled={disabled || conversionOpen}
                      onCheckedChange={(checked) =>
                        toggleItem(item.id, checked)
                      }
                    />
                    <Input
                      aria-label={`Item ${index + 1} for ${workKey}`}
                      className={`min-w-48 flex-1 ${
                        item.completed
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                      disabled={disabled || conversionOpen}
                      maxLength={1000}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      value={draft}
                    />
                    <Button
                      aria-label={`Save item ${index + 1}`}
                      disabled={
                        disabled ||
                        conversionOpen ||
                        !draft.trim() ||
                        draft.trim() === checklist[index]?.text
                      }
                      onClick={() => saveChecklist(resolvedChecklist)}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Save item
                    </Button>
                    <Button
                      aria-label={`Move item ${index + 1} up`}
                      disabled={disabled || conversionOpen || index === 0}
                      onClick={() => moveItem(index, -1)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      Move up
                    </Button>
                    <Button
                      aria-label={`Move item ${index + 1} down`}
                      disabled={
                        disabled ||
                        conversionOpen ||
                        index === resolvedChecklist.length - 1
                      }
                      onClick={() => moveItem(index, 1)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      Move down
                    </Button>
                    <Button
                      aria-label={`Delete item ${index + 1}`}
                      disabled={disabled || conversionOpen}
                      onClick={() => deleteItem(item.id)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      Delete item
                    </Button>
                    <Button
                      disabled={
                        disabled ||
                        conversionPending ||
                        conversionOpen ||
                        draft.trim() !== checklist[index]?.text
                      }
                      onClick={() => previewConversion(item.id)}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Convert to independent Work
                    </Button>
                    {conversionItemId === item.id && conversionPreview ? (
                      <section
                        aria-label="Convert to independent Work"
                        className="basis-full space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-xs"
                        role="status"
                      >
                        <p className="font-medium text-sm">
                          Convert to independent Work
                        </p>
                        <p>
                          Title:{" "}
                          <strong>{conversionPreview.newWork.title}</strong>
                        </p>
                        <p>
                          Project:{" "}
                          <strong>
                            {conversionPreview.targetProject.name}
                          </strong>
                        </p>
                        <p>
                          Start status:{" "}
                          <strong>{conversionPreview.newWork.status}</strong>
                        </p>
                        <p>
                          Origin: {conversionPreview.sourceWork.key} —{" "}
                          {conversionPreview.sourceWork.title}
                        </p>
                        <p className="text-muted-foreground">
                          Origin Location:{" "}
                          {conversionPreview.originPosition.ownerRecordId} /{" "}
                          {conversionPreview.originPosition.componentId} /{" "}
                          {conversionPreview.originPosition.sourceVersion ??
                            "Unknown"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={disabled || conversionPending}
                            onClick={confirmConversion}
                            size="xs"
                            type="button"
                          >
                            Confirm convert
                          </Button>
                          <Button
                            disabled={conversionPending}
                            onClick={cancelConversion}
                            size="xs"
                            type="button"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </section>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <form
        className="flex flex-wrap items-end gap-2 border-border/70 border-t pt-3"
        onSubmit={handleAddItemSubmit}
      >
        <addItemForm.Field name="newItem">
          {(field) => (
            <>
              <label
                className="min-w-48 flex-1 text-muted-foreground text-xs"
                htmlFor={`new-checklist-item-${workKey}`}
              >
                Item
                <Input
                  aria-label={`New item for ${workKey}`}
                  className="mt-1"
                  disabled={disabled || conversionItemId !== null}
                  id={`new-checklist-item-${workKey}`}
                  maxLength={1000}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </label>
              <Button
                disabled={
                  disabled ||
                  conversionItemId !== null ||
                  !field.state.value.trim()
                }
                size="sm"
                type="submit"
              >
                Add item
              </Button>
            </>
          )}
        </addItemForm.Field>
      </form>
    </section>
  );
}
