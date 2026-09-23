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
  COMPLETION_EFFECT_MAX_FRAME_INTERVAL_MS,
  COMPLETION_EFFECT_SLOW_FRAME_COUNT,
  WORK_COMPLETED_NOTICE_DURATION_MS,
} from "../lib/completion-effects-presentation";
import {
  claimCompletionEffectStart,
  claimUserInitiatedWorkSuccess,
  recordFailedCompletedClose,
} from "../store/user-initiated-work-success";

export type UserInitiatedWorkCloseOutcome =
  | {
      clientIdempotencyKey: string;
      closureResult: WorkClosureResult;
      kind: "failed";
      workId: string;
    }
  | {
      clientIdempotencyKey: string;
      kind: "completed";
      reopenStatus: WorkOpenStatus;
      visibleAtCloseStart: boolean;
      workId: string;
    };

export interface WorkCompletionFeedbackState {
  effect: {
    palette: CompletionEffectsPreferences["palette"];
    theme: CompletionEffectsPreferences["theme"];
  } | null;
  noticeVisible: boolean;
  reopenStatus: WorkOpenStatus | null;
}

const EMPTY_FEEDBACK: WorkCompletionFeedbackState = {
  effect: null,
  noticeVisible: false,
  reopenStatus: null,
};

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

  return claimCompletionEffectStart(
    Date.now(),
    COMPLETION_EFFECT_CLIENT_WAIT_MS,
  );
}

export default function useUserInitiatedWorkSuccess({
  accountId,
  preferences,
}: {
  accountId?: string;
  preferences: CompletionEffectsPreferences | null;
}) {
  const [feedbackByWorkId, setFeedbackByWorkId] = useState<
    Record<string, WorkCompletionFeedbackState>
  >({});
  const prefersReducedMotion = useRef(false);
  const mountedLifetime = useRef({});
  const noticeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const effectTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const effectFrames = useRef(new Map<string, number>());

  const feedbackFor = useCallback(
    (workId: string) => feedbackByWorkId[workId] ?? EMPTY_FEEDBACK,
    [feedbackByWorkId],
  );

  const updateFeedback = useCallback(
    (
      workId: string,
      update: (
        current: WorkCompletionFeedbackState,
      ) => WorkCompletionFeedbackState,
    ) => {
      setFeedbackByWorkId((current) => ({
        ...current,
        [workId]: update(current[workId] ?? EMPTY_FEEDBACK),
      }));
    },
    [],
  );

  const stopEffect = useCallback(
    (workId: string) => {
      const effectTimer = effectTimers.current.get(workId);
      if (effectTimer) {
        clearTimeout(effectTimer);
        effectTimers.current.delete(workId);
      }
      const effectFrame = effectFrames.current.get(workId);
      if (effectFrame !== undefined) {
        cancelAnimationFrame(effectFrame);
        effectFrames.current.delete(workId);
      }
      updateFeedback(workId, (current) =>
        current.effect === null ? current : { ...current, effect: null },
      );
    },
    [updateFeedback],
  );

  const stopAllEffects = useCallback(() => {
    for (const workId of Array.from(effectTimers.current.keys())) {
      stopEffect(workId);
    }
  }, [stopEffect]);

  const startCompletionEffect = useCallback(
    (
      workId: string,
      completionPreferences: CompletionEffectsPreferences,
      visibleAtCloseStart: boolean,
    ) => {
      if (
        !canStartCompletionEffect(
          completionPreferences,
          prefersReducedMotion.current,
          visibleAtCloseStart,
        )
      ) {
        return;
      }

      updateFeedback(workId, (current) => ({
        ...current,
        effect: {
          palette: completionPreferences.palette,
          theme: completionPreferences.theme,
        },
      }));

      let lastFrameAt: number | null = null;
      let slowFrameCount = 0;
      const observeFrameBudget = (frameAt: number) => {
        if (!effectTimers.current.has(workId)) {
          return;
        }
        if (lastFrameAt !== null) {
          slowFrameCount =
            frameAt - lastFrameAt > COMPLETION_EFFECT_MAX_FRAME_INTERVAL_MS
              ? slowFrameCount + 1
              : 0;
          if (slowFrameCount >= COMPLETION_EFFECT_SLOW_FRAME_COUNT) {
            stopEffect(workId);
            return;
          }
        }
        lastFrameAt = frameAt;
        effectFrames.current.set(
          workId,
          requestAnimationFrame(observeFrameBudget),
        );
      };
      effectFrames.current.set(
        workId,
        requestAnimationFrame(observeFrameBudget),
      );
      effectTimers.current.set(
        workId,
        setTimeout(() => {
          effectTimers.current.delete(workId);
          const effectFrame = effectFrames.current.get(workId);
          if (effectFrame !== undefined) {
            cancelAnimationFrame(effectFrame);
            effectFrames.current.delete(workId);
          }
          updateFeedback(workId, (current) => ({ ...current, effect: null }));
        }, COMPLETION_EFFECT_DURATION_MS),
      );
    },
    [stopEffect, updateFeedback],
  );

  const showCompletionNotice = useCallback(
    (workId: string, nextReopenStatus: WorkOpenStatus) => {
      updateFeedback(workId, (current) => ({
        ...current,
        noticeVisible: true,
        reopenStatus: nextReopenStatus,
      }));
      const currentTimer = noticeTimers.current.get(workId);
      if (currentTimer) {
        clearTimeout(currentTimer);
      }
      noticeTimers.current.set(
        workId,
        setTimeout(() => {
          noticeTimers.current.delete(workId);
          updateFeedback(workId, (current) => ({
            ...current,
            noticeVisible: false,
          }));
        }, WORK_COMPLETED_NOTICE_DURATION_MS),
      );
    },
    [updateFeedback],
  );

  const startUserInitiatedCompletionEffect = useCallback(
    (
      workId: string,
      clientIdempotencyKey: string,
      visibleAtCloseStart: boolean,
    ) => {
      if (!claimUserInitiatedWorkSuccess(clientIdempotencyKey)) {
        return;
      }
      if (preferences) {
        startCompletionEffect(workId, preferences, visibleAtCloseStart);
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
            startCompletionEffect(
              workId,
              completionPreferences,
              visibleAtCloseStart,
            );
          }
        })
        .catch(() => undefined);
    },
    [accountId, preferences, startCompletionEffect],
  );

  const handleCloseOutcome = useCallback(
    (outcome: UserInitiatedWorkCloseOutcome) => {
      if (outcome.kind === "failed") {
        if (outcome.closureResult === "Completed") {
          recordFailedCompletedClose(outcome.clientIdempotencyKey);
        }
        return;
      }

      showCompletionNotice(outcome.workId, outcome.reopenStatus);
      startUserInitiatedCompletionEffect(
        outcome.workId,
        outcome.clientIdempotencyKey,
        outcome.visibleAtCloseStart,
      );
    },
    [showCompletionNotice, startUserInitiatedCompletionEffect],
  );

  useEffect(() => {
    const lifetime = mountedLifetime.current;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      prefersReducedMotion.current = motionQuery.matches;
      if (motionQuery.matches) {
        stopAllEffects();
      }
    };
    const clearHiddenEffect = () => {
      if (document.visibilityState !== "visible") {
        stopAllEffects();
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
      for (const timer of noticeTimers.current.values()) {
        clearTimeout(timer);
      }
      noticeTimers.current.clear();
      for (const timer of effectTimers.current.values()) {
        clearTimeout(timer);
      }
      effectTimers.current.clear();
      for (const frame of effectFrames.current.values()) {
        cancelAnimationFrame(frame);
      }
      effectFrames.current.clear();
    };
  }, [stopAllEffects]);

  return {
    feedbackFor,
    handleCloseOutcome,
  };
}
