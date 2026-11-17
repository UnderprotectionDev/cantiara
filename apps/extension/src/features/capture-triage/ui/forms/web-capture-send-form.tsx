import { webCaptureSendInputSchema } from "@cantiara/api/web-capture";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";

import type {
  StoredWebCaptureLink,
  WebCaptureDraft,
  WebCaptureTarget,
} from "../../lib/web-capture";

export function WebCaptureSendForm({
  draft,
  isSending,
  link,
  onInvalid,
  onSend,
  onTargetSearchChange,
  targetSearch,
  targets,
}: {
  draft: WebCaptureDraft;
  isSending: boolean;
  link: StoredWebCaptureLink | null;
  onInvalid: () => void;
  onSend: (targetId: string) => Promise<void>;
  onTargetSearchChange: (value: string) => void;
  targetSearch: string;
  targets: WebCaptureTarget[];
}) {
  const form = useForm({
    defaultValues: { targetId: "workspace" },
    onSubmit: async ({ value }) => {
      const parsed = webCaptureSendInputSchema.safeParse({
        clientIdempotencyKey: draft.clientIdempotencyKey,
        content: draft.content,
        kind: draft.kind,
        link: draft.link ?? null,
        mediaDataUrl: draft.mediaDataUrl ?? null,
        originUrl: draft.originUrl,
        projectId:
          targets.find((target) => target.id === value.targetId)?.projectId ??
          null,
      });
      if (!parsed.success) {
        onInvalid();
        return;
      }
      await onSend(value.targetId);
    },
  });
  // The Inbox search replaces the target list; keep the choice on a listed target.
  useEffect(() => {
    if (
      targets.length > 0 &&
      !targets.some((target) => target.id === form.getFieldValue("targetId"))
    ) {
      form.setFieldValue("targetId", targets[0]?.id ?? "workspace");
    }
  }, [form, targets]);
  return (
    <form
      aria-labelledby="preview-heading"
      className="capture-section preview"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="section-heading">
        <h2 id="preview-heading">Preview</h2>
        <span className="kind-label">{draft.kind}</span>
      </div>
      <dl>
        <div>
          <dt>Content</dt>
          <dd>{draft.content || "No selected text"}</dd>
        </div>
        <div>
          <dt>Origin URL</dt>
          <dd className="url-value">{draft.originUrl}</dd>
        </div>
        <div>
          <dt>Target Inbox</dt>
          <dd>
            {link ? (
              <>
                <Input
                  aria-label="Search Inbox"
                  onChange={(event) => onTargetSearchChange(event.target.value)}
                  placeholder="Search Inbox"
                  value={targetSearch}
                />
                <form.Field name="targetId">
                  {(field) => (
                    <NativeSelect
                      aria-label="Target Inbox"
                      className="mt-[7px] w-full"
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    >
                      {targets.map((target) => (
                        <NativeSelectOption key={target.id} value={target.id}>
                          {target.name} — {target.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </form.Field>
              </>
            ) : (
              "Pair this browser to choose a Target Inbox."
            )}
          </dd>
        </div>
      </dl>
      <button
        className="send-button"
        disabled={!link || isSending || targets.length === 0}
        type="submit"
      >
        {isSending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
