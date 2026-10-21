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
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useState } from "react";

export type EvidenceCommand = Pick<
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
  const [drafts, setDrafts] = useState<Record<EvidenceQualityField, Draft>>(
    () =>
      Object.fromEntries(
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
  );
  const [role, setRole] = useState(evidence.role);
  const [followUp, setFollowUp] = useState<FeedbackFollowUp | "">(
    evidence.followUp ?? "",
  );
  const [status, setStatus] = useState<{
    kind: "error" | "ok";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  function update(field: EvidenceQualityField, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [field]: { ...current[field], ...patch },
    }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setPending(true);
    try {
      await onSave(origin, {
        expectedRevision: evidence.revision,
        followUp: followUp || null,
        quality: Object.fromEntries(
          EVIDENCE_QUALITY_FIELDS.map((field) => {
            const draft = drafts[field];
            const value = draft.value.trim();
            return [
              field,
              value
                ? {
                    founderInterpretation:
                      value === EVIDENCE_QUALITY_UNKNOWN
                        ? false
                        : draft.founderInterpretation,
                    value,
                  }
                : null,
            ];
          }),
        ),
        role,
      });
      setStatus({ kind: "ok", text: "Evidence quality saved." });
    } catch {
      setStatus({
        kind: "error",
        text: "Evidence quality could not be saved. Reload and try again.",
      });
    } finally {
      setPending(false);
    }
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
                <Input
                  className="min-w-48 flex-1"
                  disabled={readOnly || pending}
                  id={`${idBase}-${field}`}
                  maxLength={2000}
                  onChange={(event) =>
                    update(field, { value: event.target.value })
                  }
                  value={drafts[field].value}
                />
                <Button
                  disabled={readOnly || pending}
                  onClick={() =>
                    update(field, {
                      founderInterpretation: false,
                      value: EVIDENCE_QUALITY_UNKNOWN,
                    })
                  }
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
                <label className="flex items-center gap-1 text-xs">
                  <input
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
                    onChange={(event) =>
                      update(field, {
                        founderInterpretation: event.target.checked,
                      })
                    }
                    type="checkbox"
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
            <NativeSelect
              disabled={readOnly || pending}
              id={`${idBase}-role`}
              onChange={(event) =>
                setRole(event.target.value as typeof evidence.role)
              }
              value={role}
            >
              {EVIDENCE_ROLES.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idBase}-follow-up`}>Follow-up</label>
            <NativeSelect
              disabled={readOnly || pending}
              id={`${idBase}-follow-up`}
              onChange={(event) =>
                setFollowUp(event.target.value as FeedbackFollowUp | "")
              }
              value={followUp}
            >
              <NativeSelectOption value="">None</NativeSelectOption>
              {FEEDBACK_FOLLOW_UPS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
