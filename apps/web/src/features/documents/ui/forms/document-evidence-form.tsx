// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers and the plan reset.
import {
  DOCUMENT_EVIDENCE_TARGET_TYPES,
  type DocumentEvidenceBinding,
  type DocumentEvidencePlan,
  previewDocumentEvidenceInputSchema,
} from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { documentEvidenceFormSchema } from "../../lib/document-evidence-form";
import { EvidencePreview } from "../components/document-evidence-preview";

type TargetType = (typeof DOCUMENT_EVIDENCE_TARGET_TYPES)[number];
type WorkType = "Task" | "Bug" | "Research" | "Improvement";
type Mode = "bind" | "create";
interface Range {
  end: number;
  start: number;
}

export default function DocumentEvidenceForm({
  mode,
  onClose,
  range,
  rebind,
  record,
}: {
  mode: Mode;
  onClose: () => void;
  range: Range;
  rebind: DocumentEvidenceBinding | null;
  record: Document;
}) {
  const { projectId } = record;
  const cache = useQueryClient();
  const [plan, setPlan] = useState<DocumentEvidencePlan | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const command = useRef<{ id: string; key: string; recordId: string } | null>(
    null,
  );
  const selection = { documentId: record.id, projectId: projectId ?? "" };
  const targets = useQuery({
    ...orpc.documentEvidenceTargets.queryOptions({ input: selection }),
    enabled: Boolean(projectId) && mode === "bind" && !rebind,
  });
  const form = useForm({
    defaultValues: {
      targetId: "",
      title: "",
      type: "Work" as TargetType,
      workType: "Task" as WorkType,
    },
    onSubmit: ({ value }) => preview(value),
  });
  const { targetId, title, type } = useStore(
    form.store,
    (state) => state.values,
  );
  const candidates = (targets.data ?? []).filter(
    (target) => target.type === type,
  );
  let ready = true;
  if (!rebind) {
    ready = mode === "bind" ? targetId.length > 0 : title.trim().length > 0;
  }

  function changed() {
    setPlan(null);
    command.current = null;
  }
  function request(
    base: {
      documentId: string;
      end: number;
      projectId: string;
      start: number;
      versionRevision: number;
    },
    values: { title: string; type: TargetType; workType: WorkType },
    chosen: (typeof candidates)[number] | undefined,
  ) {
    if (rebind) {
      return { ...base, bindingId: rebind.id };
    }
    if (mode === "bind" && chosen) {
      return {
        ...base,
        target: {
          type: chosen.type,
          projectId: chosen.projectId,
          recordId: chosen.recordId,
        },
      };
    }
    return {
      ...base,
      newRecord: {
        type: values.type,
        projectId: base.projectId,
        title: values.title,
        ...(values.type === "Work" ? { workType: values.workType } : {}),
      },
    };
  }
  async function preview(value: unknown) {
    const parsedValue = documentEvidenceFormSchema.safeParse(value);
    if (!(projectId && parsedValue.success) || pending) {
      return;
    }
    const values = parsedValue.data;
    // A new preview is a new command; a failed confirm's key must not replay against a changed plan.
    command.current = null;
    const chosen = candidates.find(
      (target) => target.recordId === values.targetId,
    );
    setPending(true);
    setError(null);
    try {
      const base = {
        ...selection,
        versionRevision: record.revision,
        start: range.start,
        end: range.end,
      };
      const input = previewDocumentEvidenceInputSchema.safeParse(
        request(base, values, chosen),
      );
      if (!input.success) {
        throw new Error("Evidence preview is unavailable.");
      }
      setPlan(await client.previewDocumentEvidence(input.data));
    } catch {
      setError(
        "Evidence preview is unavailable. Save the Document and reselect the text.",
      );
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    if (!plan || pending) {
      return;
    }
    command.current ??= {
      id: rebind?.id ?? crypto.randomUUID(),
      key: crypto.randomUUID(),
      recordId: crypto.randomUUID(),
    };
    const identity = command.current;
    setPending(true);
    setError(null);
    try {
      await runOnlineOnlyWrite(() =>
        client.confirmDocumentEvidence({
          ...selection,
          id: identity.id,
          baseRevision: plan.bindingRevision,
          clientIdempotencyKey: identity.key,
          plan,
          ...(plan.mode === "create" ? { recordId: identity.recordId } : {}),
        }),
      );
      command.current = null;
      await cache.invalidateQueries({
        queryKey: orpc.documentEvidenceBindings.key(),
      });
      onClose();
    } catch {
      setError(
        "Evidence could not be saved. Reload if the Document or target changed, then preview again.",
      );
    } finally {
      setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  let heading = "Bind as evidence to existing record";
  if (rebind) {
    heading = "Rebind to new version";
  } else if (mode === "create") {
    heading = "Convert to new record and bind";
  }
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            Version {record.revision} · Range {range.start}–{range.end}. This
            creates no AI summary and exactly one{" "}
            {mode === "create" ? "new record" : "evidence relation"}.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          {rebind ? null : (
            <div className="space-y-2">
              <Label htmlFor="document-evidence-type">Record type</Label>
              <form.Field name="type">
                {(field) => (
                  <NativeSelect
                    id="document-evidence-type"
                    name={field.name}
                    onChange={(event) => {
                      field.handleChange(event.target.value as TargetType);
                      form.setFieldValue("targetId", "");
                      changed();
                    }}
                    value={field.state.value}
                  >
                    {DOCUMENT_EVIDENCE_TARGET_TYPES.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </form.Field>
              {mode === "bind" ? (
                <>
                  <Label htmlFor="document-evidence-record">
                    Existing record
                  </Label>
                  <form.Field name="targetId">
                    {(field) => (
                      <NativeSelect
                        id="document-evidence-record"
                        name={field.name}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          changed();
                        }}
                        value={field.state.value}
                      >
                        <NativeSelectOption value="">
                          Choose a record
                        </NativeSelectOption>
                        {candidates.map((target) => (
                          <NativeSelectOption
                            key={target.recordId}
                            value={target.recordId}
                          >
                            {target.title}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </form.Field>
                </>
              ) : (
                <>
                  <Label htmlFor="document-evidence-title">Title</Label>
                  <form.Field name="title">
                    {(field) => (
                      <Input
                        id="document-evidence-title"
                        maxLength={255}
                        name={field.name}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          changed();
                        }}
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                  {type === "Work" ? (
                    <>
                      <Label htmlFor="document-evidence-work-type">
                        Work type
                      </Label>
                      <form.Field name="workType">
                        {(field) => (
                          <NativeSelect
                            id="document-evidence-work-type"
                            name={field.name}
                            onChange={(event) => {
                              field.handleChange(
                                event.target.value as WorkType,
                              );
                              changed();
                            }}
                            value={field.state.value}
                          >
                            {(
                              [
                                "Task",
                                "Bug",
                                "Research",
                                "Improvement",
                              ] as const
                            ).map((value) => (
                              <NativeSelectOption key={value} value={value}>
                                {value}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                      </form.Field>
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}
          {plan ? <EvidencePreview plan={plan} /> : null}
          {error ? <p role="alert">{error}</p> : null}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!ready || pending}
              type="submit"
              variant="outline"
            >
              Preview
            </Button>
            <Button disabled={!plan || pending} onClick={confirm} type="button">
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
