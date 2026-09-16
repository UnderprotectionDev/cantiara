import type {
  GitHubAvailability as GitHubAvailabilityReader,
  GitHubAvailabilityStatus,
} from "@cantiara/api/context";

export type { GitHubAvailabilityStatus } from "@cantiara/api/context";

export interface GitHubAvailability extends GitHubAvailabilityReader {
  markAvailable: () => void;
  markLoginConsentSatisfied: () => void;
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
    },
    markLoginConsentSatisfied: () => {
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
