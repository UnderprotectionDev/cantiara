import { describe, expect, test } from "vitest";

import { createGitHubAvailability } from "./github-availability";

describe("GitHub availability", () => {
  test("keeps waiting and fresh-consent state separate from product sessions", () => {
    const availability = createGitHubAvailability();

    expect(availability.getStatus()).toBe("available");
    expect(availability.requiresFreshConsent()).toBe(false);

    availability.markUnavailable();
    availability.requireFreshConsent();

    expect(availability.getStatus()).toBe("waiting");
    expect(availability.requiresFreshConsent()).toBe(true);

    availability.markAvailable();

    expect(availability.getStatus()).toBe("available");
    expect(availability.requiresFreshConsent()).toBe(true);

    availability.markLoginConsentSatisfied();

    expect(availability.requiresFreshConsent()).toBe(false);
  });
});
