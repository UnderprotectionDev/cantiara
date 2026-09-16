export type GitHubAvailabilityStatus = "available" | "waiting";

export interface GitHubAvailability {
  getStatus: () => GitHubAvailabilityStatus;
  markAvailable: () => void;
  markUnavailable: () => void;
  requireFreshConsent: () => void;
  requiresFreshConsent: () => boolean;
}

export function createGitHubAvailability(): GitHubAvailability {
  let status: GitHubAvailabilityStatus = "available";
  let freshConsentRequired = false;

  return {
    getStatus: () => status,
    markAvailable: () => {
      status = "available";
      freshConsentRequired = false;
    },
    markUnavailable: () => {
      status = "waiting";
    },
    requireFreshConsent: () => {
      freshConsentRequired = true;
    },
    requiresFreshConsent: () => freshConsentRequired,
  };
}
