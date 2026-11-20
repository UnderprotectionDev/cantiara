// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current item state.

import {
  type WorkChecklistConversionPreview,
  type WorkChecklistItem,
  workChecklistSchema,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { AppLink } from "@/components/app-link";
import { resolveChecklistDrafts } from "../../lib/work-checklist-items";
import { ChecklistConversionPreview } from "../components/checklist-conversion-preview";
import { AddChecklistItemForm } from "../forms/add-checklist-item-form";

export default function WorkChecklist({
  checklist,
  disabled,
  conversionItemId = null,
  conversionPending = false,
  conversionPreview,
  onCancelConvert,
  onConfirmConvert,
  onPreviewConvert,
  onSave,
  workKey,
}: {
  checklist: WorkChecklistItem[];
  disabled: boolean;
  conversionItemId?: string | null;
  conversionPending?: boolean;
  conversionPreview?: WorkChecklistConversionPreview | null;
  onCancelConvert?: () => void;
  onConfirmConvert: (
    preview: WorkChecklistConversionPreview,
  ) => Promise<unknown>;
  onPreviewConvert: (itemId: string) => void;
  onSave: (checklist: WorkChecklistItem[]) => Promise<unknown>;
  workKey: string;
}) {
  const draftsForm = useForm({
    defaultValues: {
      drafts: Object.fromEntries(
        checklist.map((item) => [item.id, item.text]),
      ) as Record<string, string>,
    },
    onSubmit: async ({ value }) => {
      const resolved = resolveChecklistDrafts(checklist, value.drafts);
      if (!workChecklistSchema.safeParse(resolved).success) {
        return;
      }
      await saveChecklist(resolved);
    },
  });
  const drafts = useSelector(draftsForm.store, (state) => state.values.drafts);
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

  async function confirmConversion() {
    if (conversionPreview) {
      await onConfirmConvert(conversionPreview).catch(() => undefined);
    }
  }

  function handleDraftsSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    draftsForm.handleSubmit().catch(() => undefined);
  }

  return (
    <section
      aria-label={`Checklist for ${workKey}`}
      className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium">Checklist</h4>
        {resolvedChecklist.length > 0 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {completedCount} of {resolvedChecklist.length} complete
          </p>
        ) : null}
      </div>
      {resolvedChecklist.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add the first small step for this Work.
        </p>
      ) : (
        <form noValidate onSubmit={handleDraftsSubmit}>
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
                      <AppLink
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`#work-${encodeURIComponent(item.convertedWork.id)}`}
                      >
                        {item.convertedWork.key} — {item.convertedWork.title}
                      </AppLink>
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
                          draftsForm.setFieldValue("drafts", (current) => ({
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
                        size="xs"
                        type="submit"
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
                        onClick={() => onPreviewConvert(item.id)}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        Convert to independent Work
                      </Button>
                      {conversionItemId === item.id && conversionPreview ? (
                        <ChecklistConversionPreview
                          disabled={disabled}
                          onCancel={onCancelConvert ?? (() => undefined)}
                          onConfirm={confirmConversion}
                          pending={conversionPending}
                          preview={conversionPreview}
                        />
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </form>
      )}
      <AddChecklistItemForm
        disabled={disabled || conversionItemId !== null}
        onAdd={(item) => saveChecklist([...resolvedChecklist, item])}
        workKey={workKey}
      />
    </section>
  );
}
