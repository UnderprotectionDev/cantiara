export const DESKTOP_API_CONTRACT_HEADER =
  "x-cantiara-desktop-api-contract" as const;
export const DESKTOP_API_UPDATE_REQUIRED_HEADER =
  "x-cantiara-desktop-api-update-required" as const;
export const DESKTOP_API_UPDATE_REQUIRED_CODE = "UPDATE_REQUIRED" as const;

export const DESKTOP_API_WINDOW_DAYS = 30 as const;
export const DESKTOP_API_WINDOW_MS =
  DESKTOP_API_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const DESKTOP_API_CURRENT_CONTRACT = "cantiara-desktop-api/v2" as const;
export const DESKTOP_API_PREVIOUS_CONTRACT = "cantiara-desktop-api/v1" as const;
export const DESKTOP_API_PUBLISHED_AT = "2026-08-26T00:00:00.000Z" as const;

export interface DesktopApiCompatibilityWindow {
  currentContract: string;
  previousContract: string;
  publishedAt: string;
}

export const DEFAULT_DESKTOP_API_COMPATIBILITY_WINDOW = {
  currentContract: DESKTOP_API_CURRENT_CONTRACT,
  previousContract: DESKTOP_API_PREVIOUS_CONTRACT,
  publishedAt: DESKTOP_API_PUBLISHED_AT,
} as const satisfies DesktopApiCompatibilityWindow;

export type DesktopApiCompatibilityFailureReason =
  | "missing-contract"
  | "unsupported-contract"
  | "window-expired";

export type DesktopApiCompatibilityResult =
  | { accepted: true; contract: string; expiresAt: string }
  | { accepted: false; reason: DesktopApiCompatibilityFailureReason };

export function evaluateDesktopApiCompatibility(
  contract: unknown,
  compatibilityWindow: DesktopApiCompatibilityWindow,
  now = new Date(),
): DesktopApiCompatibilityResult {
  if (typeof contract !== "string" || contract.length === 0) {
    return { accepted: false, reason: "missing-contract" };
  }

  if (
    contract !== compatibilityWindow.currentContract &&
    contract !== compatibilityWindow.previousContract
  ) {
    return { accepted: false, reason: "unsupported-contract" };
  }

  const publishedAt = Date.parse(compatibilityWindow.publishedAt);
  const currentTime = now.getTime();
  if (!(Number.isFinite(publishedAt) && Number.isFinite(currentTime))) {
    return { accepted: false, reason: "window-expired" };
  }

  const expiresAt = publishedAt + DESKTOP_API_WINDOW_MS;
  if (currentTime > expiresAt) {
    return { accepted: false, reason: "window-expired" };
  }

  return {
    accepted: true,
    contract,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function isDesktopApiUpdateRequiredResponse(response: Response) {
  return (
    response.status === 426 &&
    response.headers.get(DESKTOP_API_UPDATE_REQUIRED_HEADER) === "true"
  );
}
