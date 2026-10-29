// biome-ignore-all lint/performance/noJsxPropsBind: Composer controls capture current URL, request and save state.
import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import {
  type SmartLinkPreview,
  type SmartLinkPreviewAccess,
  safePreviewLink,
  youtubeVideoId,
} from "@cantiara/api/smart-link-preview";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { type ClipboardEvent, useRef, useState } from "react";
import { YouTubePreviewPlayer } from "@/components/youtube-preview-player";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";

export function SmartLinkComposer({
  onPreview,
  onSave,
  readOnly = false,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
  youtubePlayerOrigin,
}: {
  onPreview: SmartLinkPreviewAccess;
  onSave: (preview: SmartLinkPreview) => Promise<void>;
  readOnly?: boolean;
  preferences?: AccountPreferences;
  youtubePlayerOrigin?: string;
}) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<SmartLinkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const requestNumber = useRef(0);
  async function load(value: string) {
    requestNumber.current += 1;
    const request = requestNumber.current;
    setPreview(null);
    setMessage("");
    setLoading(true);
    try {
      const result = await onPreview(value);
      if (request === requestNumber.current) {
        setPreview(result);
      }
    } catch {
      if (request === requestNumber.current) {
        setMessage("Preview unavailable. Try Preview again.");
      }
    } finally {
      if (request === requestNumber.current) {
        setLoading(false);
      }
    }
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const value = event.clipboardData.getData("text").trim();
    setUrl(value);
    load(value).catch(() => undefined);
  }
  function change(event: React.ChangeEvent<HTMLInputElement>) {
    requestNumber.current += 1;
    setUrl(event.target.value);
    setPreview(null);
    setMessage("");
    setLoading(false);
  }
  function requestPreview() {
    load(url).catch(() => undefined);
  }
  async function save() {
    if (!preview || saving) {
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave(preview);
      setMessage("Source saved.");
    } catch {
      setMessage("Source could not be saved. Try Save as Source again.");
    } finally {
      setSaving(false);
    }
  }
  const originalLink = safePreviewLink(url);
  const videoId = youtubeVideoId(url);
  return (
    <section
      aria-label="Smart link preview"
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      <div className="space-y-2">
        <label className="font-medium text-sm" htmlFor="source-url">
          Source URL
        </label>
        <Input
          disabled={saving}
          id="source-url"
          onChange={change}
          onPaste={paste}
          value={url}
        />
      </div>
      <Button
        disabled={loading || saving || !url.trim()}
        onClick={requestPreview}
        type="button"
        variant="outline"
      >
        Preview
      </Button>
      {loading ? <p role="status">Loading preview…</p> : null}
      {originalLink !== null && (
        <a
          className="block break-all underline"
          href={originalLink}
          rel="noopener noreferrer"
          target="_blank"
        >
          {originalLink}
        </a>
      )}
      <SmartLinkPreviewContent
        preferences={preferences}
        preview={preview}
        readOnly={readOnly}
        save={save}
        saving={saving}
        videoId={videoId}
        youtubePlayerOrigin={youtubePlayerOrigin}
      />
      {Boolean(message) && (
        <p role={message === "Source saved." ? "status" : "alert"}>{message}</p>
      )}
    </section>
  );
}

function SmartLinkPreviewContent({
  preview,
  videoId,
  youtubePlayerOrigin,
  preferences,
  saving,
  readOnly,
  save,
}: {
  preview: SmartLinkPreview | null;
  videoId: string | null;
  youtubePlayerOrigin: string | undefined;
  preferences: AccountPreferences;
  saving: boolean;
  readOnly: boolean;
  save: () => Promise<void>;
}) {
  return (
    preview !== null && (
      <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">Live preview</h3>
        <p className="text-muted-foreground text-sm">
          This preview is not a Source or historical evidence.
        </p>
        {preview.kind === "preview" && (
          <>
            <p className="font-medium">{preview.title}</p>
            <p className="text-muted-foreground text-sm">{preview.domain}</p>
          </>
        )}
        {preview.image?.startsWith("data:image/webp;base64,") && (
          <img
            alt=""
            className="max-h-64 max-w-full rounded-md object-contain"
            height={256}
            src={preview.image}
            width={512}
          />
        )}
        {Boolean(preview.error) && <p role="alert">{preview.error}</p>}
        {videoId !== null && (
          <YouTubePreviewPlayer
            available={preview.player !== null}
            key={videoId}
            playerOrigin={youtubePlayerOrigin}
            videoId={videoId}
          />
        )}
        {preview.kind === "preview" && (
          <>
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="font-medium text-sm">Historical snapshot</p>
              {videoId !== null && (
                <p className="text-muted-foreground text-sm">
                  Only the video title is captured; playback is live.
                </p>
              )}
              <p className="text-muted-foreground text-sm">
                Save the title and captured text from{" "}
                {formatAccountDateTime(preview.accessedAt, preferences)}. Later
                external changes will not update this snapshot.
              </p>
              <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">
                {preview.capturedContent || "No text was captured."}
              </p>
            </div>
            <Button disabled={saving || readOnly} onClick={save} type="button">
              {saving ? "Saving…" : "Save as Source"}
            </Button>
          </>
        )}
      </div>
    )
  );
}
