/**
 * Client Shell seam — secret-free Support reference for a failed main flow.
 * docs/specs/03-web-macos-client/spec.md and
 * docs/prd/15-product-quality.md#gozlemlenebilirlik
 */
import {
	CLIENT_SHELL_COPY,
	issueMainFlowFailure,
	presentFailedMainFlow,
	toMainFlowFailureError,
} from "@cantiara/api/client-shell-failure";
import { expect, test } from "vitest";

import { mainFlowFailureToast } from "./client-shell";

const PAGER_COPY = /pager|S1|on-call|24\/7/i;

test("a failed main flow shows the reason, retry bound, write outcome, and Support reference", () => {
	const presented = presentFailedMainFlow(
		issueMainFlowFailure({
			reason: "Couldn't save Preferences.",
			trackingId: "CANT-0F1E2D3C",
			written: false,
		})
	);

	expect(presented.reason).toBe("Couldn't save Preferences.");
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.retryBound).toBe("You can retry once.");
	expect(presented.supportReferenceLabel).toBe("Support reference");
	expect(presented.supportReference).toBe("CANT-0F1E2D3C");
	expect(presented.retry).toBe("Retry");
});

test("Support reference and the log sink omit tokens, session secrets, emails, and Workspace bodies", () => {
	const logs: unknown[] = [];
	const token =
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature";
	const sessionSecret = "sess_live_abc123";
	const email = "founder@example.com";
	const workspaceBody = "Private wiki: the Atlas launch passphrase is hunter2";
	const presented = presentFailedMainFlow(
		issueMainFlowFailure(
			{
				privateContent: [workspaceBody],
				reason: `Save failed for ${email} with ${token} session_token=${sessionSecret}: ${workspaceBody}`,
				trackingId: "CANT-AABBCCDD",
				written: false,
			},
			{
				write: (record) => {
					logs.push(record);
				},
			}
		)
	);
	const haystack = JSON.stringify({ logs, presented });

	expect(presented.reason).toBe("This action could not be completed.");
	expect(presented.supportReference).toBe("CANT-AABBCCDD");
	expect(haystack).not.toContain(token);
	expect(haystack).not.toContain(sessionSecret);
	expect(haystack).not.toContain(email);
	expect(haystack).not.toContain(workspaceBody);
	expect(haystack).not.toContain("hunter2");
});

test("a failed main flow that already wrote data says so and does not offer Retry", () => {
	const presented = presentFailedMainFlow(
		issueMainFlowFailure({
			reason: "Couldn't notify after save.",
			trackingId: "CANT-11112222",
			written: true,
		})
	);

	expect(presented.writeOutcome).toBe("Data was written.");
	expect(presented.retryBound).toBe("Do not retry.");
	expect(presented.retry).toBeUndefined();
});

test("Client Shell does not present the failure as a pager or on-call alarm", () => {
	const presented = presentFailedMainFlow(
		issueMainFlowFailure({
			reason: "Couldn't save Preferences.",
			trackingId: "CANT-33334444",
			written: false,
		})
	);
	const copy = `${Object.values(CLIENT_SHELL_COPY).join(" ")} ${JSON.stringify(presented)}`;

	expect(copy).not.toMatch(PAGER_COPY);
});

test("Retry is the toast action only when data was not written", () => {
	const retryable = mainFlowFailureToast(
		issueMainFlowFailure({
			reason: "Couldn't save Preferences.",
			trackingId: "CANT-55556666",
			written: false,
		}),
		() => undefined
	);
	const written = mainFlowFailureToast(
		issueMainFlowFailure({
			reason: "Couldn't notify after save.",
			trackingId: "CANT-77778888",
			written: true,
		}),
		() => undefined
	);

	expect(retryable.options.action?.label).toBe("Retry");
	expect(written.options.action).toBeUndefined();
});

test("a failure without a server tracking ID does not invent a Support reference", () => {
	const presented = presentFailedMainFlow(
		new Error("Couldn't save Preferences.")
	);

	expect(presented.reason).toBe("Couldn't save Preferences.");
	expect(presented.supportReference).toBe("");
	expect(presented.description).not.toContain("CANT-");
	expect(presented.description).not.toContain("Support reference");
});

test("the server tracking ID on a failed RPC is the Support reference Client Shell shows", () => {
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(new Error("Couldn't save Preferences."), undefined, {
			trackingId: "CANT-99AA88BB",
		})
	);

	expect(presented.reason).toBe("Couldn't save Preferences.");
	expect(presented.supportReference).toBe("CANT-99AA88BB");
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.retry).toBe("Retry");
});
