import type {
  WebCaptureKind,
  WebCapturePairingInput,
} from "@cantiara/api/web-capture";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  captureActiveTabScreenshot,
  clearStoredWebCaptureLink,
  getStoredWebCaptureLink,
  getWebCaptureBrowser,
  listWebCaptureTargets,
  pairWebCapture,
  readActiveTab,
  type StoredWebCaptureLink,
  sendWebCapture,
  WebCaptureApiError,
  type WebCaptureDraft,
  type WebCaptureTarget,
} from "../../lib/web-capture";
import {
  CAPTURE_ACTIONS,
  draftFor,
  formatSavedAt,
  PAIRING_INVALID_MESSAGE,
} from "../../lib/web-capture-draft";
import { WebCapturePreview } from "../components/web-capture-preview";
import { WebCapturePairing } from "../forms/web-capture-form";

async function clearStoredWebCaptureLinkBestEffort() {
  try {
    await clearStoredWebCaptureLink();
    return true;
  } catch {
    return false;
  }
}

export function WebCaptureView() {
  const browser = useMemo(() => getWebCaptureBrowser(), []);
  const [link, setLink] = useState<StoredWebCaptureLink | null>(null);
  const [draft, setDraft] = useState<WebCaptureDraft | null>(null);
  const [targets, setTargets] = useState<WebCaptureTarget[]>([]);
  const [targetId, setTargetId] = useState("workspace");
  const [targetSearch, setTargetSearch] = useState("");
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
          clearStoredWebCaptureLinkBestEffort();
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

  async function handlePair(input: WebCapturePairingInput) {
    setError(null);
    setStatus(null);
    setIsPairing(true);
    try {
      const stored = await pairWebCapture(input);
      setLink(stored);
      setStatus("This browser is paired with Web Capture.");
    } catch (reason) {
      setError(
        reason instanceof WebCaptureApiError &&
          reason.code === "WEB_CAPTURE_PAIRING_INVALID"
          ? PAIRING_INVALID_MESSAGE
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

      <WebCapturePairing
        browser={browser}
        isPairing={isPairing}
        link={link}
        onInvalid={() => {
          setStatus(null);
          setError(PAIRING_INVALID_MESSAGE);
        }}
        onPair={handlePair}
      />

      {draft ? (
        <WebCapturePreview
          draft={draft}
          isSending={isSending}
          link={link}
          onSend={handleSend}
          onTargetIdChange={setTargetId}
          onTargetSearchChange={setTargetSearch}
          targetId={targetId}
          targetSearch={targetSearch}
          targets={targets}
        />
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
