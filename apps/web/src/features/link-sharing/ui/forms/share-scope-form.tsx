// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  APPROVE_SCOPE_LABEL,
  LIVE_LABEL,
  PUBLISH_SHARE_ANYWAY_LABEL,
  type ShareItem,
  type ShareScopePreview,
} from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  defaultShareScopeDraft,
  groupsNeedingChoice,
  type ShareScopeFormDraft,
  shareItemSections,
  shareScopeFormSchema,
} from "../../lib/share-scope-form";

const slug = (value: string) => value.replaceAll(/[^a-zA-Z0-9]+/g, "-");

export type ShareScopeFormSubmit = ShareScopeFormDraft;

function stateNote(item: ShareItem) {
  if (item.leavesScope) {
    return "Leaves the link: it no longer matches the filter through a Live field.";
  }
  if (item.candidate) {
    return "New match: not shared until you approve it.";
  }
  if (!item.selectable) {
    return "Not shared: its other end is not in this scope.";
  }
  return item.state && item.state !== "Approved" ? item.state : null;
}

/**
 * Approve the closed world: every record, field, version, attachment, embed,
 * relation and view part is its own checkbox (an exclusive group is a radio
 * set). `Live` appears only for allow-listed fields. `Publish/share anyway`
 * is a separate confirmation that scope approval never implies.
 */
export function ShareScopeForm({
  onSubmit,
  preview,
}: {
  onSubmit: (values: ShareScopeFormSubmit) => Promise<unknown>;
  preview: ShareScopePreview;
}) {
  const [error, setError] = useState<string | null>(null);
  const sections = shareItemSections(preview);
  const form = useForm({
    defaultValues: defaultShareScopeDraft(preview),
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = shareScopeFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Choose what to share.");
        return;
      }
      const missing = groupsNeedingChoice(preview, parsed.data.approved);
      if (missing.length > 0) {
        setError(`Choose exactly one: ${missing.join(", ")}.`);
        return;
      }
      const approved = new Set(parsed.data.approved);
      try {
        await onSubmit({
          approved: parsed.data.approved,
          live: parsed.data.live.filter((id) => approved.has(id)),
          publishAnyway: parsed.data.publishAnyway,
        });
      } catch {
        setError(
          "The scope could not be approved. Review the preview and try again.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={APPROVE_SCOPE_LABEL}
      className="space-y-6"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {preview.blockers.map((blocker) => (
        <p className="text-sm" key={blocker} role="alert">
          {blocker}
        </p>
      ))}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            {sections.map((section) => (
              <fieldset
                className="grid gap-3 rounded-lg border border-border/70 p-4"
                key={section.record.itemId}
              >
                <legend className="px-1 font-medium text-sm">
                  {section.record.label}
                </legend>
                <form.Field name="approved">
                  {(approvedField) => (
                    <form.Field name="live">
                      {(liveField) => (
                        <>
                          <ul className="grid gap-2">
                            {[section.record, ...section.items].map((item) => (
                              <ShareItemRow
                                approved={approvedField.state.value}
                                disabled={isSubmitting}
                                item={item}
                                key={item.itemId}
                                live={liveField.state.value}
                                onApprovedChange={(next) => {
                                  approvedField.handleChange(next);
                                  liveField.handleChange(
                                    liveField.state.value.filter((id) =>
                                      next.includes(id),
                                    ),
                                  );
                                }}
                                onLiveChange={liveField.handleChange}
                              />
                            ))}
                          </ul>
                          {section.groups.map((group) => (
                            <fieldset className="grid gap-2" key={group.name}>
                              <legend className="text-sm">
                                {group.name} (choose one)
                              </legend>
                              <RadioGroup
                                disabled={isSubmitting}
                                name={`group-${slug(section.record.itemId)}-${slug(group.name)}`}
                                onValueChange={(next) =>
                                  approvedField.handleChange([
                                    ...approvedField.state.value.filter(
                                      (id) =>
                                        !group.items.some(
                                          (item) => item.itemId === id,
                                        ),
                                    ),
                                    String(next),
                                  ])
                                }
                                value={
                                  group.items.find((item) =>
                                    approvedField.state.value.includes(
                                      item.itemId,
                                    ),
                                  )?.itemId ?? ""
                                }
                              >
                                {group.items.map((item) => (
                                  <label
                                    className="inline-flex items-center gap-2 text-sm"
                                    htmlFor={`share-${slug(item.itemId)}`}
                                    key={item.itemId}
                                  >
                                    <RadioGroupItem
                                      id={`share-${slug(item.itemId)}`}
                                      value={item.itemId}
                                    />
                                    <span>
                                      {item.label}
                                      {item.value ? (
                                        <span className="block whitespace-pre-wrap text-muted-foreground">
                                          {item.value}
                                        </span>
                                      ) : null}
                                    </span>
                                  </label>
                                ))}
                              </RadioGroup>
                            </fieldset>
                          ))}
                        </>
                      )}
                    </form.Field>
                  )}
                </form.Field>
              </fieldset>
            ))}
            {preview.placeholders.length > 0 ? (
              <form.Field name="publishAnyway">
                {(field) => (
                  <label
                    className="inline-flex items-center gap-2 text-sm"
                    htmlFor="share-publish-anyway"
                  >
                    <Checkbox
                      checked={field.state.value}
                      disabled={isSubmitting}
                      id="share-publish-anyway"
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                    {PUBLISH_SHARE_ANYWAY_LABEL}: share with the unresolved
                    placeholders above
                  </label>
                )}
              </form.Field>
            ) : null}
            <Button
              disabled={isSubmitting || preview.blockers.length > 0}
              type="submit"
            >
              {isSubmitting ? "Approving…" : "Approve scope"}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

function ShareItemRow({
  approved,
  disabled,
  item,
  live,
  onApprovedChange,
  onLiveChange,
}: {
  approved: string[];
  disabled: boolean;
  item: ShareItem;
  live: string[];
  onApprovedChange: (next: string[]) => void;
  onLiveChange: (next: string[]) => void;
}) {
  const checked = approved.includes(item.itemId);
  const note = stateNote(item);
  const id = `share-${slug(item.itemId)}`;
  return (
    <li className="grid gap-1">
      <label className="inline-flex items-start gap-2 text-sm" htmlFor={id}>
        <Checkbox
          checked={checked}
          disabled={disabled || !item.selectable}
          id={id}
          onCheckedChange={(next) =>
            onApprovedChange(
              next === true
                ? [...approved, item.itemId]
                : approved.filter((value) => value !== item.itemId),
            )
          }
        />
        <span>
          {item.label}
          {item.value ? (
            <span className="block max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">
              {item.value}
            </span>
          ) : null}
        </span>
      </label>
      {note ? (
        <p className="ml-6 text-muted-foreground text-xs">{note}</p>
      ) : null}
      {item.liveEligible && checked ? (
        <label
          className="ml-6 inline-flex items-center gap-2 text-sm"
          htmlFor={`${id}-live`}
        >
          <Checkbox
            checked={live.includes(item.itemId)}
            disabled={disabled}
            id={`${id}-live`}
            onCheckedChange={(next) =>
              onLiveChange(
                next === true
                  ? [...live, item.itemId]
                  : live.filter((value) => value !== item.itemId),
              )
            }
          />
          {LIVE_LABEL}: keep {item.label} current
        </label>
      ) : null}
    </li>
  );
}
