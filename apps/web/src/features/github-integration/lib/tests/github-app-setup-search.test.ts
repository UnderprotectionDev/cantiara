import { expect, test } from "vitest";

import { gitHubAppSetupFromSearch } from "../github-app-setup-search";

test("reads the installation id and state GitHub appends to the Setup URL", () => {
  expect(
    gitHubAppSetupFromSearch({
      installation_id: "123",
      setup_action: "install",
      state: "signed.state",
    }),
  ).toEqual({ installationId: 123, state: "signed.state" });
});

test("treats a visit without a state or with a bad id as no install", () => {
  expect(gitHubAppSetupFromSearch({ installation_id: "123" })).toEqual({});
  expect(
    gitHubAppSetupFromSearch({ installation_id: "abc", state: "x" }),
  ).toEqual({});
  expect(gitHubAppSetupFromSearch({})).toEqual({});
});
