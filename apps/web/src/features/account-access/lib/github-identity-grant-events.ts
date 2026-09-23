let pendingGrantHandler: ((grant: string) => void) | null = null;

export function waitForTauriGitHubIdentityGrant() {
  if (pendingGrantHandler) {
    throw new Error("A GitHub identity confirmation is already in progress.");
  }

  let resolveGrant: (grant: string) => void = () => undefined;
  let rejectGrant: (error: Error) => void = () => undefined;
  const promise = new Promise<string>((resolve, reject) => {
    resolveGrant = resolve;
    rejectGrant = reject;
  });
  const timeoutId = window.setTimeout(
    () => {
      pendingGrantHandler = null;
      rejectGrant(new Error("GitHub identity confirmation timed out."));
    },
    10 * 60 * 1000,
  );

  pendingGrantHandler = (grant) => {
    window.clearTimeout(timeoutId);
    pendingGrantHandler = null;
    resolveGrant(grant);
  };

  return {
    cancel() {
      window.clearTimeout(timeoutId);
      pendingGrantHandler = null;
      rejectGrant(new Error("GitHub identity confirmation was cancelled."));
    },
    promise,
  };
}

export function deliverTauriGitHubIdentityGrant(grant: string) {
  pendingGrantHandler?.(grant);
}
