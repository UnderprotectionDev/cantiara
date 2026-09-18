import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type ActiveTabCapture,
  captureActiveTabScreenshot,
  clearStoredWebCaptureLink,
  getStoredWebCaptureLink,
  getWebCaptureBrowser,
  listWebCaptureTargets,
  pairWebCapture,
  readActiveTab,
  sendWebCapture,
  WebCaptureApiError,
  type WebCaptureBrowser,
  type WebCaptureDraft,
  type WebCaptureKind,
  type WebCaptureTarget,
} from "../../src/web-capture";

const HTTP_URL_PATTERN = /^https?:\/\//;

const CAPTURE_ACTIONS: Array<{
  kind: WebCaptureKind;
  label: string;
}> = [
  { kind: "url", label: "Capture URL" },
  { kind: "selected-text", label: "Capture selected text" },
  { kind: "selected-image", label: "Capture selected image" },
  { kind: "screenshot", label: "Capture screenshot" },
];

function draftFor(
  kind: WebCaptureKind,
  tab: ActiveTabCapture,
  mediaDataUrl?: string,
): WebCaptureDraft {
  if (kind === "selected-text") {
    return {
      content: tab.selectedText,
      kind,
      link: tab.url,
      originUrl: tab.url,
    };
  }
  if (kind === "selected-image") {
    const { selectedImageUrl, url } = tab;
    const selectedImageLink =
      selectedImageUrl && HTTP_URL_PATTERN.test(selectedImageUrl)
        ? selectedImageUrl
        : url;
    return {
      content: "Selected image",
      kind,
      link: selectedImageLink,
      originUrl: tab.url,
    };
  }
  if (kind === "screenshot") {
    return {
      content: `Screenshot of ${tab.title || tab.url}`,
      kind,
      link: tab.url,
      mediaDataUrl,
      originUrl: tab.url,
    };
  }
  return {
    content: tab.title || tab.url,
    kind,
    link: tab.url,
    originUrl: tab.url,
  };
}

function formatSavedAt(value: string | null) {
  if (!value) {
    return "Not yet";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function App() {
  const browser = useMemo(() => getWebCaptureBrowser(), []);
  const [link, setLink] = useState<{
    browser: WebCaptureBrowser;
    device: string;
    id: string;
    lastSuccessfulSave: string | null;
    token: string;
  } | null>(null);
  const [draft, setDraft] = useState<WebCaptureDraft | null>(null);
  const [targets, setTargets] = useState<WebCaptureTarget[]>([]);
  const [targetId, setTargetId] = useState("workspace");
  const [targetSearch, setTargetSearch] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [device, setDevice] = useState("Browser extension");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isReading, setIsReading] = useState(true);

  useEffect(() => {
    let active = true;
    getStoredWebCaptureLink()
      .then((stored) => {
        if (!active) {
          return;
        }
        setLink(stored);
        setIsReading(false);
      })
      .catch((reason: unknown) => {
        if (!active) {
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "This page cannot be captured.",
        );
        setIsReading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!link) {
      setTargets([]);
      return;
    }
    let active = true;
    listWebCaptureTargets(link.token, targetSearch)
      .then((nextTargets) => {
        if (!active) {
          return;
        }
        setTargets(nextTargets);
        if (!nextTargets.some((target) => target.id === targetId)) {
          setTargetId(nextTargets[0]?.id ?? "workspace");
        }
      })
      .catch((reason: unknown) => {
        if (!active) {
          return;
        }
        if (reason instanceof WebCaptureApiError && reason.status === 401) {
          // biome-ignore lint/complexity/noVoid: Expired local credentials are cleared best-effort while the UI re-pairs.
          void clearStoredWebCaptureLink();
          setLink(null);
          setError(
            "This browser needs to be paired again before it can read Inbox targets.",
          );
        } else {
          setError("Inbox targets are unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [link, targetId, targetSearch]);

  const chooseCapture = useCallback(async (kind: WebCaptureKind) => {
    setError(null);
    setStatus(null);
    try {
      const currentTab = await readActiveTab(
        kind === "selected-text" || kind === "selected-image",
      );
      if (kind === "screenshot") {
        const mediaDataUrl = await captureActiveTabScreenshot();
        setDraft(draftFor(kind, currentTab, mediaDataUrl));
      } else {
        setDraft(draftFor(kind, currentTab));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Capture failed.");
    }
  }, []);

  async function handlePair(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!browser) {
      setError("This browser cannot pair with Web Capture.");
      return;
    }
    setError(null);
    setStatus(null);
    setIsPairing(true);
    try {
      const stored = await pairWebCapture({
        browser,
        code: pairingCode.trim(),
        device: device.trim() || "Browser extension",
      });
      setLink(stored);
      setPairingCode("");
      setStatus("This browser is paired with Web Capture.");
    } catch (reason) {
      setError(
        reason instanceof WebCaptureApiError &&
          reason.code === "WEB_CAPTURE_PAIRING_INVALID"
          ? "This Pairing code is invalid, expired, or already used."
          : "This browser could not be paired.",
      );
    } finally {
      setIsPairing(false);
    }
  }

  async function handleSend() {
    if (!(link && draft)) {
      return;
    }
    setError(null);
    setStatus(null);
    setIsSending(true);
    try {
      const result = await sendWebCapture(
        link.token,
        draft,
        targets.find((target) => target.id === targetId)?.projectId ?? null,
      );
      setLink((current) =>
        current ? { ...current, lastSuccessfulSave: result.savedAt } : current,
      );
      setStatus("Sent to Capture Inbox.");
    } catch (reason) {
      if (
        reason instanceof WebCaptureApiError &&
        (reason.status === 401 || reason.code === "WEB_CAPTURE_REAUTH_REQUIRED")
      ) {
        await clearStoredWebCaptureLink();
        setLink(null);
        setError("This browser needs to be paired again before it can write.");
      } else {
        setError("Capture could not be sent. No local queue was created.");
      }
    } finally {
      setIsSending(false);
    }
  }

  if (isReading) {
    return <main className="capture-app">Loading Web Capture…</main>;
  }

  return (
    <main className="capture-app">
      <header className="capture-header">
        <div>
          <p className="eyebrow">Cantiara</p>
          <h1>Web Capture</h1>
        </div>
        <span className="browser-badge">{browser ?? "Safari unsupported"}</span>
      </header>
      <p className="muted">
        Capture actions read only the active tab after you choose one. Web
        Capture does not read history or keep an offline queue.
      </p>

      <section
        aria-labelledby="capture-actions-heading"
        className="capture-section"
      >
        <h2 id="capture-actions-heading">Capture</h2>
        <div className="capture-actions">
          {CAPTURE_ACTIONS.map((action) => (
            <button
              className={draft?.kind === action.kind ? "selected" : ""}
              key={action.kind}
              onClick={() => chooseCapture(action.kind)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {link ? null : (
        <section aria-labelledby="pair-heading" className="capture-section">
          <h2 id="pair-heading">Pair this browser</h2>
          <p className="muted">
            Generate a Pairing code in Cantiara, then enter it here. This
            pairing code expires in five minutes and can be used once.
          </p>
          {browser ? (
            <form className="pair-form" onSubmit={handlePair}>
              <label>
                Pairing code
                <input
                  autoComplete="one-time-code"
                  onChange={(event) => setPairingCode(event.target.value)}
                  placeholder="CANTIARA-AB12-CD34"
                  value={pairingCode}
                />
              </label>
              <label>
                Device
                <input
                  maxLength={255}
                  onChange={(event) => setDevice(event.target.value)}
                  value={device}
                />
              </label>
              <button
                disabled={isPairing || pairingCode.trim().length === 0}
                type="submit"
              >
                {isPairing ? "Pairing…" : "Pair"}
              </button>
            </form>
          ) : (
            <p className="warning">
              This browser cannot pair with Web Capture.
            </p>
          )}
        </section>
      )}

      {draft ? (
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
                    <input
                      aria-label="Search Inbox"
                      onChange={(event) => setTargetSearch(event.target.value)}
                      placeholder="Search Inbox"
                      value={targetSearch}
                    />
                    <select
                      aria-label="Target Inbox"
                      onChange={(event) => setTargetId(event.target.value)}
                      value={targetId}
                    >
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name} — {target.label}
                        </option>
                      ))}
                    </select>
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
            onClick={handleSend}
            type="button"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </section>
      ) : null}

      {link ? (
        <p className="last-save">
          Last successful save: {formatSavedAt(link.lastSuccessfulSave)}
        </p>
      ) : null}
      {status ? (
        <p className="success" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
