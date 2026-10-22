// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the field being edited.
import { EVIDENCE_ROLES } from "@cantiara/api/document-evidence";
import {
  EVIDENCE_QUALITY_FIELDS,
  EVIDENCE_QUALITY_LABELS,
  EVIDENCE_QUALITY_UNKNOWN,
  type EvidenceQualityField,
  FEEDBACK_FOLLOW_UPS,
  type FeedbackFollowUp,
  type FeedbackWorkOrigin,
  type SetFeedbackEvidenceInput,
  setFeedbackEvidenceInputSchema,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

type EvidenceCommand = Pick<
  SetFeedbackEvidenceInput,
  "expectedRevision" | "followUp" | "quality" | "role"
>;
export type SaveEvidence = (
  origin: FeedbackWorkOrigin,
  command: EvidenceCommand,
) => Promise<unknown>;

interface Draft {
  founderInterpretation: boolean;
  value: string;
}

/**
 * `Evidence quality` of one Work-Feedback link. The original message is shown
 * elsewhere as its own text; nothing here is read from it. Every field may be
 * blank or `Unknown`, and the role and follow-up are separate controls.
 */
export function EvidenceQualityPanel({
  onSave,
  origin,
  readOnly,
}: {
  onSave: SaveEvidence;
  origin: FeedbackWorkOrigin;
  readOnly: boolean;
}) {
  const { evidence } = origin;
  const [status, setStatus] = useState<{
    kind: "error" | "ok";
    text: string;
  } | null>(null);
  const form = useForm({
    defaultValues: {
      followUp: (evidence.followUp ?? "") as FeedbackFollowUp | "",
      quality: Object.fromEntries(
        EVIDENCE_QUALITY_FIELDS.map((field) => {
          const entry = evidence.quality[field];
          return [
            field,
            {
              // A new value defaults to interpretation: the source did not say it.
              founderInterpretation: entry ? entry.founderInterpretation : true,
              value: entry?.value ?? "",
            },
          ];
        }),
      ) as Record<EvidenceQualityField, Draft>,
      role: evidence.role,
    },
    onSubmit: async ({ value }) => {
      setStatus(null);
      const command = {
        expectedRevision: evidence.revision,
        followUp: value.followUp || null,
        quality: Object.fromEntries(
          EVIDENCE_QUALITY_FIELDS.map((field) => {
            const draft = value.quality[field];
            const text = draft.value.trim();
            return [
              field,
              text
                ? {
                    founderInterpretation:
                      text === EVIDENCE_QUALITY_UNKNOWN
                        ? false
                        : draft.founderInterpretation,
                    value: text,
                  }
                : null,
            ];
          }),
        ),
        role: value.role,
      };
      try {
        const parsed = setFeedbackEvidenceInputSchema
          .pick({
            expectedRevision: true,
            followUp: true,
            quality: true,
            role: true,
          })
          .safeParse(command);
        if (!parsed.success) {
          throw new Error("Evidence quality is invalid.");
        }
        await onSave(origin, command);
        setStatus({ kind: "ok", text: "Evidence quality saved." });
      } catch {
        setStatus({
          kind: "error",
          text: "Evidence quality could not be saved. Reload and try again.",
        });
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const drafts = useStore(form.store, (state) => state.values.quality);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const idBase = `evidence-${origin.id}`;
  return (
    <details className="rounded-md border border-border/60 p-3">
      <summary className="cursor-pointer font-medium">
        Evidence quality for {origin.workKey}
      </summary>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <p className="text-muted-foreground text-xs">
          Optional. Leave a field blank or enter Unknown. These values describe
          this link only and are separate from the original message.
        </p>
        {EVIDENCE_QUALITY_FIELDS.map((field) => {
          const entry = evidence.quality[field];
          return (
            <div className="grid gap-1 text-sm" key={field}>
              <label htmlFor={`${idBase}-${field}`}>
                {EVIDENCE_QUALITY_LABELS[field]}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <form.Field name={`quality.${field}.value`}>
                  {(valueField) => (
                    <Input
                      className="min-w-48 flex-1"
                      disabled={readOnly || pending}
                      id={`${idBase}-${field}`}
                      maxLength={2000}
                      name={valueField.name}
                      onChange={(event) =>
                        valueField.handleChange(event.target.value)
                      }
                      value={valueField.state.value}
                    />
                  )}
                </form.Field>
                <Button
                  disabled={readOnly || pending}
                  onClick={() => {
                    form.setFieldValue(
                      `quality.${field}.founderInterpretation`,
                      false,
                    );
                    form.setFieldValue(
                      `quality.${field}.value`,
                      EVIDENCE_QUALITY_UNKNOWN,
                    );
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Unknown
                  <span className="sr-only">
                    {" "}
                    for {EVIDENCE_QUALITY_LABELS[field]}
                  </span>
                </Button>
                <label
                  className="flex items-center gap-1 text-xs"
                  htmlFor={`${idBase}-${field}-interpretation`}
                >
                  <Checkbox
                    checked={
                      drafts[field].value.trim() === EVIDENCE_QUALITY_UNKNOWN
                        ? false
                        : drafts[field].founderInterpretation
                    }
                    disabled={
                      readOnly ||
                      pending ||
                      drafts[field].value.trim() === EVIDENCE_QUALITY_UNKNOWN
                    }
                    id={`${idBase}-${field}-interpretation`}
                    onCheckedChange={(checked) =>
                      form.setFieldValue(
                        `quality.${field}.founderInterpretation`,
                        checked,
                      )
                    }
                  />
                  Founder interpretation
                  <span className="sr-only">
                    {" "}
                    for {EVIDENCE_QUALITY_LABELS[field]}
                  </span>
                </label>
              </div>
              {entry?.founderInterpretation ? (
                <p className="text-muted-foreground text-xs">
                  Founder interpretation by {entry.author} at{" "}
                  <time dateTime={entry.recordedAt}>{entry.recordedAt}</time>
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idBase}-role`}>Evidence Role</label>
            <form.Field name="role">
              {(field) => (
                <NativeSelect
                  disabled={readOnly || pending}
                  id={`${idBase}-role`}
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as typeof evidence.role,
                    )
                  }
                  value={field.state.value}
                >
                  {EVIDENCE_ROLES.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {item}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idBase}-follow-up`}>Follow-up</label>
            <form.Field name="followUp">
              {(field) => (
                <NativeSelect
                  disabled={readOnly || pending}
                  id={`${idBase}-follow-up`}
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as FeedbackFollowUp | "",
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {FEEDBACK_FOLLOW_UPS.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {item}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
          </div>
        </div>
        {status ? (
          <p
            className={
              status.kind === "error"
                ? "text-destructive text-sm"
                : "text-muted-foreground text-sm"
            }
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.text}
          </p>
        ) : null}
        {readOnly ? null : (
          <Button disabled={pending} type="submit">
            Save Evidence quality
          </Button>
        )}
        {evidence.history.length > 0 ? (
          <section aria-label="Evidence quality history" className="text-xs">
            <h6 className="font-medium">History</h6>
            <ul className="text-muted-foreground">
              {evidence.history.map((item) => (
                <li key={item.revision}>
                  <time dateTime={item.changedAt}>{item.changedAt}</time> by{" "}
                  {item.actor}: {item.changedFields.join(", ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </form>
    </details>
  );
}
