import type {
  WebCaptureKind,
  WebCapturePairingInput,
} from "@cantiara/api/web-capture";
import { useSelector } from "@tanstack/react-form";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
  useCreateStore,
  useSelector as useStoreSelector,
} from "@tanstack/react-store";
import { useEffect, useMemo, useRef } from "react";
import { useWebCaptureInboxSearch } from "../../hooks/use-web-capture-inbox-search";

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
} from "../../lib/web-capture";
import {
  CAPTURE_ACTIONS,
  draftFor,
  formatSavedAt,
  PAIRING_INVALID_MESSAGE,
} from "../../lib/web-capture-draft";
import { WebCapturePairing } from "../forms/web-capture-form";
import { WebCaptureSendForm } from "../forms/web-capture-send-form";

async function clearStoredWebCaptureLinkBestEffort() {
  try {
    await clearStoredWebCaptureLink();
    return true;
  } catch {
    return false;
  }
}

function needsPairing(error: unknown) {
  return (
    error instanceof WebCaptureApiError &&
    (error.status === 401 || error.code === "WEB_CAPTURE_REAUTH_REQUIRED")
  );
}

function pairingErrorMessage(error: unknown) {
  return error instanceof WebCaptureApiError &&
    error.code === "WEB_CAPTURE_PAIRING_INVALID"
    ? PAIRING_INVALID_MESSAGE
    : "This browser could not be paired.";
}

function sendErrorMessage(error: unknown) {
  return needsPairing(error)
    ? "This browser needs to be paired again before it can write."
    : "Capture could not be sent. No local queue was created.";
}

export function WebCaptureView() {
  const browser = useMemo(() => getWebCaptureBrowser(), []);
  const initial: {
    link: StoredWebCaptureLink | null;
    draft: WebCaptureDraft | null;
    localError: string | null;
    isReading: boolean;
  } = { link: null, draft: null, localError: null, isReading: true };
  const capture = useCreateStore(initial, ({ setState }) => ({
    setLink: (
      next: import("react").SetStateAction<StoredWebCaptureLink | null>,
    ) =>
      setState((state) => ({
        ...state,
        link: typeof next === "function" ? next(state.link) : next,
      })),
    setDraft: (next: WebCaptureDraft | null) =>
      setState((state) => ({ ...state, draft: next })),
    setLocalError: (next: string | null) =>
      setState((state) => ({ ...state, localError: next })),
    setIsReading: (next: boolean) =>
      setState((state) => ({ ...state, isReading: next })),
  }));
  const { link, draft, localError, isReading } = useStoreSelector(capture);
  const { setLink, setDraft, setLocalError, setIsReading } = capture.actions;
  const searchForm = useWebCaptureInboxSearch();
  const targetSearch = useSelector(
    searchForm.store,
    (state) => state.values.targetSearch,
  );

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
        setLocalError(
          reason instanceof Error
            ? reason.message
            : "This page cannot be captured.",
        );
        setIsReading(false);
      });
    return () => {
      active = false;
    };
  }, [setIsReading, setLink, setLocalError]);

  const search = targetSearch.trim();
  const targetQuery = useQuery({
    queryKey: ["web-capture-targets", link?.id, search],
    queryFn: link
      ? ({ signal }) => listWebCaptureTargets(link.token, search, signal)
      : skipToken,
  });
  const targets = targetQuery.data ?? [];

  useEffect(() => {
    if (
      link &&
      targetQuery.error instanceof WebCaptureApiError &&
      targetQuery.error.status === 401
    ) {
      clearStoredWebCaptureLinkBestEffort().catch(() => undefined);
      setLink(null);
      setLocalError(
        "This browser needs to be paired again before it can read Inbox targets.",
      );
    }
  }, [link, setLink, setLocalError, targetQuery.error]);

  const pairingInput = useRef<WebCapturePairingInput | null>(null);
  const pair = useMutation({
    mutationFn: async () => {
      const input = pairingInput.current;
      pairingInput.current = null;
      if (!(input && navigator.onLine)) {
        throw new Error("This browser could not be paired.");
      }
      setLink(await pairWebCapture(input));
    },
  });

  const clipToSend = useRef<{
    draft: WebCaptureDraft;
    token: string;
    projectId: string | null;
  } | null>(null);
  const lastCommand = useRef<{
    draftId: string;
    projectId: string | null;
    key: string;
  } | null>(null);
  const send = useMutation({
    mutationFn: async () => {
      const clip = clipToSend.current;
      clipToSend.current = null;
      if (!(clip && navigator.onLine)) {
        throw new Error(
          "Capture could not be sent. No local queue was created.",
        );
      }
      const receipt = await sendWebCapture(
        clip.token,
        clip.draft,
        clip.projectId,
      );
      setLink((current) =>
        current?.token === clip.token
          ? { ...current, lastSuccessfulSave: receipt.savedAt }
          : current,
      );
      return receipt;
    },
    onError: async (reason) => {
      if (needsPairing(reason)) {
        await clearStoredWebCaptureLinkBestEffort();
        setLink(null);
      }
    },
  });

  const busy = pair.isPending || send.isPending;
  const targetError =
    link && targetQuery.isError ? "Inbox targets are unavailable." : null;
  const sendError = send.isError ? sendErrorMessage(send.error) : null;
  const pairError = pair.isError ? pairingErrorMessage(pair.error) : null;
  const error = localError ?? sendError ?? pairError ?? targetError;
  const pairedMessage = pair.isSuccess
    ? "This browser is paired with Web Capture."
    : null;
  const status = send.isSuccess ? "Sent to Capture Inbox." : pairedMessage;

  async function chooseCapture(kind: WebCaptureKind) {
    setLocalError(null);
    send.reset();
    pair.reset();
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
      setLocalError(
        reason instanceof Error ? reason.message : "Capture failed.",
      );
    }
  }

  async function handlePair(input: WebCapturePairingInput) {
    if (busy || pairingInput.current) {
      return;
    }
    setLocalError(null);
    send.reset();
    pairingInput.current = input;
    await pair.mutateAsync().catch(() => undefined);
  }

  async function handleSend(targetId: string) {
    const target = targets.find(({ id }) => id === targetId);
    if (busy || !(link && draft && target)) {
      return;
    }
    setLocalError(null);
    pair.reset();
    const { projectId } = target;
    const draftId = draft.clientIdempotencyKey;
    const previous = lastCommand.current;
    if (previous?.draftId !== draftId || previous.projectId !== projectId) {
      lastCommand.current = {
        draftId,
        projectId,
        key: previous?.draftId === draftId ? crypto.randomUUID() : draftId,
      };
    }
    clipToSend.current = {
      draft: {
        ...draft,
        clientIdempotencyKey: lastCommand.current?.key ?? draftId,
      },
      projectId,
      token: link.token,
    };
    await send.mutateAsync().catch(() => undefined);
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
              disabled={busy}
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
        isPairing={busy}
        link={link}
        onInvalid={() => {
          pair.reset();
          setLocalError(PAIRING_INVALID_MESSAGE);
        }}
        onPair={handlePair}
      />

      {draft ? (
        <WebCaptureSendForm
          draft={draft}
          isSending={busy}
          link={link}
          onInvalid={() => {
            send.reset();
            setLocalError(
              "Capture could not be sent. No local queue was created.",
            );
          }}
          onSend={handleSend}
          searchForm={searchForm}
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
