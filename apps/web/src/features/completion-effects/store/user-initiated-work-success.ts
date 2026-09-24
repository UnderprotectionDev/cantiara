import { Store } from "@tanstack/react-store";

interface UserInitiatedWorkSuccessState {
  failedCompletedCloseRequests: Set<string>;
  handledCompletedCloseRequests: Set<string>;
  lastCompletionEffectStartedAt: number | null;
}

const initialState: UserInitiatedWorkSuccessState = {
  failedCompletedCloseRequests: new Set(),
  handledCompletedCloseRequests: new Set(),
  lastCompletionEffectStartedAt: null,
};

export const userInitiatedWorkSuccessStore = new Store(initialState);

export function recordFailedCompletedClose(clientIdempotencyKey: string) {
  userInitiatedWorkSuccessStore.setState((state) => {
    if (state.failedCompletedCloseRequests.has(clientIdempotencyKey)) {
      return state;
    }
    const failedCompletedCloseRequests = new Set(
      state.failedCompletedCloseRequests,
    );
    failedCompletedCloseRequests.add(clientIdempotencyKey);
    return { ...state, failedCompletedCloseRequests };
  });
}

export function claimUserInitiatedWorkSuccess(clientIdempotencyKey: string) {
  let claimed = false;
  userInitiatedWorkSuccessStore.setState((state) => {
    if (
      state.failedCompletedCloseRequests.has(clientIdempotencyKey) ||
      state.handledCompletedCloseRequests.has(clientIdempotencyKey)
    ) {
      return state;
    }
    const handledCompletedCloseRequests = new Set(
      state.handledCompletedCloseRequests,
    );
    handledCompletedCloseRequests.add(clientIdempotencyKey);
    claimed = true;
    return { ...state, handledCompletedCloseRequests };
  });
  return claimed;
}

export function claimCompletionEffectStart(now: number, waitMs: number) {
  let claimed = false;
  userInitiatedWorkSuccessStore.setState((state) => {
    if (
      state.lastCompletionEffectStartedAt !== null &&
      now - state.lastCompletionEffectStartedAt < waitMs
    ) {
      return state;
    }
    claimed = true;
    return { ...state, lastCompletionEffectStartedAt: now };
  });
  return claimed;
}
