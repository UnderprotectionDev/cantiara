import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";

import type {
  StoredWebCaptureLink,
  WebCaptureDraft,
  WebCaptureTarget,
} from "../../lib/web-capture";

export function WebCapturePreview({
  draft,
  isSending,
  link,
  onSend,
  onTargetIdChange,
  onTargetSearchChange,
  targetId,
  targetSearch,
  targets,
}: {
  draft: WebCaptureDraft;
  isSending: boolean;
  link: StoredWebCaptureLink | null;
  onSend: () => void;
  onTargetIdChange: (value: string) => void;
  onTargetSearchChange: (value: string) => void;
  targetId: string;
  targetSearch: string;
  targets: WebCaptureTarget[];
}) {
  return (
    <section
      aria-labelledby="preview-heading"
      className="capture-section preview"
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
                <NativeSelect
                  aria-label="Target Inbox"
                  className="mt-[7px] w-full"
                  onChange={(event) => onTargetIdChange(event.target.value)}
                  value={targetId}
                >
                  {targets.map((target) => (
                    <NativeSelectOption key={target.id} value={target.id}>
                      {target.name} — {target.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
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
        onClick={onSend}
        type="button"
      >
        {isSending ? "Sending…" : "Send"}
      </button>
    </section>
  );
}
