import type { CompletionEffectsPreferences } from "@cantiara/api/completion-effects";
import type {
  WorkClosureResult,
  WorkOpenStatus,
} from "@cantiara/api/work-lifecycle";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "@/utils/orpc";
import {
  COMPLETION_EFFECT_CLIENT_WAIT_MS,
  COMPLETION_EFFECT_DURATION_MS,
  WORK_COMPLETED_NOTICE_DURATION_MS,
} from "../lib/completion-effects-presentation";

const failedCompletedCloseRequests = new Set<string>();
const handledCompletedCloseRequests = new Set<string>();
let lastCompletionEffectStartedAt: number | null = null;

type UserInitiatedWorkCloseOutcome =
  | {
      clientIdempotencyKey: string;
      closureResult: WorkClosureResult;
      kind: "failed";
    }
  | {
      clientIdempotencyKey: string;
      kind: "completed";
      reopenStatus: WorkOpenStatus;
      visibleAtCloseStart: boolean;
    };

function claimUserInitiatedWorkSuccess(clientIdempotencyKey: string) {
  if (
    failedCompletedCloseRequests.has(clientIdempotencyKey) ||
    handledCompletedCloseRequests.has(clientIdempotencyKey)
  ) {
    return false;
  }
  handledCompletedCloseRequests.add(clientIdempotencyKey);
  return true;
}

function canStartCompletionEffect(
  preferences: CompletionEffectsPreferences,
  prefersReducedMotion: boolean,
  visibleAtCloseStart: boolean,
) {
  if (
    !preferences.enabled ||
    prefersReducedMotion ||
    !visibleAtCloseStart ||
    document.visibilityState !== "visible"
  ) {
    return false;
  }

  const now = Date.now();
  if (
    lastCompletionEffectStartedAt !== null &&
    now - lastCompletionEffectStartedAt < COMPLETION_EFFECT_CLIENT_WAIT_MS
  ) {
    return false;
  }

  lastCompletionEffectStartedAt = now;
  return true;
}

export default function useUserInitiatedWorkSuccess({
  accountId,
  preferences,
}: {
  accountId?: string;
  preferences: CompletionEffectsPreferences | null;
}) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [reopenStatus, setReopenStatus] = useState<WorkOpenStatus | null>(null);
  const [effect, setEffect] = useState<{
    palette: CompletionEffectsPreferences["palette"];
    theme: CompletionEffectsPreferences["theme"];
  } | null>(null);
  const prefersReducedMotion = useRef(false);
  const mountedLifetime = useRef({});
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopEffect = useCallback(() => {
    if (effectTimer.current) {
      clearTimeout(effectTimer.current);
      effectTimer.current = null;
    }
    setEffect(null);
  }, []);

  function startCompletionEffect(
    completionPreferences: CompletionEffectsPreferences,
    visibleAtCloseStart: boolean,
  ) {
    if (
      !canStartCompletionEffect(
        completionPreferences,
        prefersReducedMotion.current,
        visibleAtCloseStart,
      )
    ) {
      return;
    }

    if (effectTimer.current) {
      clearTimeout(effectTimer.current);
    }
    setEffect({
      palette: completionPreferences.palette,
      theme: completionPreferences.theme,
    });
    effectTimer.current = setTimeout(() => {
      setEffect(null);
      effectTimer.current = null;
    }, COMPLETION_EFFECT_DURATION_MS);
  }

  function showCompletionNotice(nextReopenStatus: WorkOpenStatus) {
    setReopenStatus(nextReopenStatus);
    setNoticeVisible(true);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => {
      setNoticeVisible(false);
      noticeTimer.current = null;
    }, WORK_COMPLETED_NOTICE_DURATION_MS);
  }

  function startUserInitiatedCompletionEffect(
    clientIdempotencyKey: string,
    visibleAtCloseStart: boolean,
  ) {
    if (!claimUserInitiatedWorkSuccess(clientIdempotencyKey)) {
      return;
    }
    if (preferences) {
      startCompletionEffect(preferences, visibleAtCloseStart);
      return;
    }
    if (!accountId) {
      return;
    }

    const lifetime = mountedLifetime.current;
    client
      .completionEffectsPreferences()
      .then((completionPreferences) => {
        if (mountedLifetime.current === lifetime) {
          startCompletionEffect(completionPreferences, visibleAtCloseStart);
        }
      })
      .catch(() => undefined);
  }

  function handleCloseOutcome(outcome: UserInitiatedWorkCloseOutcome) {
    if (outcome.kind === "failed") {
      if (outcome.closureResult === "Completed") {
        failedCompletedCloseRequests.add(outcome.clientIdempotencyKey);
      }
      return;
    }

    showCompletionNotice(outcome.reopenStatus);
    startUserInitiatedCompletionEffect(
      outcome.clientIdempotencyKey,
      outcome.visibleAtCloseStart,
    );
  }

  useEffect(() => {
    const lifetime = mountedLifetime.current;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      prefersReducedMotion.current = motionQuery.matches;
      if (motionQuery.matches) {
        stopEffect();
      }
    };
    const clearHiddenEffect = () => {
      if (document.visibilityState !== "visible") {
        stopEffect();
      }
    };

    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);
    document.addEventListener("visibilitychange", clearHiddenEffect);
    return () => {
      if (mountedLifetime.current === lifetime) {
        mountedLifetime.current = {};
      }
      motionQuery.removeEventListener("change", updateMotionPreference);
      document.removeEventListener("visibilitychange", clearHiddenEffect);
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
      if (effectTimer.current) {
        clearTimeout(effectTimer.current);
      }
    };
  }, [stopEffect]);

  return {
    effect,
    handleCloseOutcome,
    noticeVisible,
    reopenStatus,
  };
}
