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

test("the failed-flow toast stays until dismissed so Retry remains reachable", () => {
	const retryable = mainFlowFailureToast(
		issueMainFlowFailure({
			reason: "Couldn't save Preferences.",
			trackingId: "CANT-DEADBEEF",
			written: false,
		}),
		() => undefined
	);

	expect(retryable.options.duration).toBe(Number.POSITIVE_INFINITY);
	expect(retryable.options.closeButton).toBe(true);
	expect(retryable.options.action?.label).toBe("Retry");
});

test("a failed Inbox list does not pin the toast", () => {
	const listFailure = toMainFlowFailureError(
		new Error(
			"undefined is not an object (evaluating 'input.prisma.captureInboxItem.findMany')"
		),
		undefined,
		{ trackingId: "CANT-F89497F0" }
	);
	const listed = mainFlowFailureToast(listFailure, () => undefined, "query");

	expect(listed.options.duration).toBe(4000);
	expect(listed.options.closeButton).toBe(true);
	expect(listed.options.action?.label).toBe("Retry");
	expect(listed.message).toBe(
		"undefined is not an object (evaluating 'input.prisma.captureInboxItem.findMany')"
	);
});

test("a written failure does not pin the toast", () => {
	const written = mainFlowFailureToast(
		issueMainFlowFailure({
			reason: "Couldn't notify after save.",
			trackingId: "CANT-77778888",
			written: true,
		}),
		() => undefined
	);

	expect(written.options.duration).toBe(4000);
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

test("an unmatched RPC Not Found stays secret-free and does not use HTTP jargon as the reason", () => {
	const presented = presentFailedMainFlow(new Error("Not Found"));

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.staleRpcRouter);
	expect(presented.reason).not.toBe("Not Found");
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.retryBound).toBe("You can retry once.");
	expect(presented.retry).toBe("Retry");
	expect(presented.description).toBe(
		"Data was not written. You can retry once."
	);
});

test("a plain HTTP 404 Not Found body stays secret-free and does not use HTTP jargon as the reason", () => {
	const presented = presentFailedMainFlow(new Error("404 Not Found"));

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.staleRpcRouter);
	expect(presented.reason).not.toContain("404");
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

test("a thrown failure marked written presents Data was written and no Retry", () => {
	const error = new Error("Couldn't notify after save.") as Error & {
		written: boolean;
	};
	error.written = true;
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(error, undefined, { trackingId: "CANT-CAFEBABE" })
	);

	expect(presented.writeOutcome).toBe("Data was written.");
	expect(presented.retryBound).toBe("Do not retry.");
	expect(presented.retry).toBeUndefined();
	expect(presented.supportReference).toBe("CANT-CAFEBABE");
});

test("a Prisma schema dump stays secret-free and still says Data was not written", () => {
	const prismaSchemaDump = new Error(`model AccountPreference { id String @id
  accountId String @unique
  locale String
}`);
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(prismaSchemaDump, undefined, {
			trackingId: "CANT-C09398DB",
		})
	);

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.pendingMigrations);
	expect(presented.reason).not.toContain("AccountPreference");
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.supportReference).toBe("CANT-C09398DB");
	expect(presented.description).toBe(
		"Data was not written. You can retry once. Support reference CANT-C09398DB"
	);
});

test("a Prisma Work list schema mismatch stays secret-free and still says Data was not written", () => {
	const prismaListFailure =
		new Error(`Invalid \`prisma.work.findMany()\` invocation in
/workspace/apps/server/src/features/work-lifecycle/server/work-lifecycle.ts:386:33

The column \`work.description\` does not exist in the current database.`);
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(prismaListFailure, undefined, {
			trackingId: "CANT-4F1C9DA6",
		})
	);

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.pendingMigrations);
	expect(presented.reason).not.toBe(CLIENT_SHELL_COPY.failed);
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.retryBound).toBe("You can retry once.");
	expect(presented.retry).toBe("Retry");
	expect(presented.supportReference).toBe("CANT-4F1C9DA6");
	expect(presented.description).toBe(
		"Data was not written. You can retry once. Support reference CANT-4F1C9DA6"
	);
});

test("a missing Postgres relation after reset still says pending migrations", () => {
	const missingTable = Object.assign(
		new Error('relation "usage_link" does not exist'),
		{ code: "42P01" }
	);
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(missingTable, undefined, {
			trackingId: "CANT-USAGE01",
		})
	);

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.pendingMigrations);
	expect(presented.writeOutcome).toBe("Data was not written.");
});

test("a Prisma unknown originWork include stays secret-free and still says Data was not written", () => {
	const prismaListFailure = new Error(
		"Unknown field 'originWork' for include statement on model 'Work'."
	);
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(prismaListFailure, undefined, {
			trackingId: "CANT-25F768C5",
		})
	);

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.staleGeneratedClient);
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.retry).toBe("Retry");
	expect(presented.supportReference).toBe("CANT-25F768C5");
});

test("a Prisma unknown markingMarks argument stays secret-free and still says Data was not written", () => {
	const prismaWriteFailure = new Error(
		"Unknown argument `markingMarks`. Available options are marked with ?."
	);
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(prismaWriteFailure, undefined, {
			trackingId: "CANT-FFEE4F19",
		})
	);

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.staleGeneratedClient);
	expect(presented.reason).not.toContain("markingMarks");
	expect(presented.writeOutcome).toBe("Data was not written.");
	expect(presented.retryBound).toBe("You can retry once.");
	expect(presented.supportReference).toBe("CANT-FFEE4F19");
});

test("a Prisma P2022 code maps to pending migrations without leaking a workspace path", () => {
	const prismaKnown = Object.assign(
		new Error("Invalid prisma.work.findMany() invocation"),
		{ code: "P2022" }
	);
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(prismaKnown, undefined, {
			trackingId: "CANT-00P2022A",
		})
	);

	expect(presented.reason).toBe(CLIENT_SHELL_COPY.pendingMigrations);
	expect(JSON.stringify(presented)).not.toContain("/workspace/");
});

test("a multiline failure without secrets keeps a readable reason", () => {
	const presented = presentFailedMainFlow(
		toMainFlowFailureError(
			new Error("Couldn't list Work.\nRetry after the database catches up."),
			undefined,
			{ trackingId: "CANT-0A1B2C3D" }
		)
	);

	expect(presented.reason).toBe(
		"Couldn't list Work. Retry after the database catches up."
	);
	expect(presented.reason).not.toBe(CLIENT_SHELL_COPY.failed);
});

test("an unmatched usage RPC 404 asks to restart the API instead of Not Found", () => {
	const honoText = presentFailedMainFlow({
		message: "Not Found",
		status: 404,
	});
	const honoPlain = presentFailedMainFlow(new Error("404 Not Found"));

	expect(honoText.reason).toBe(CLIENT_SHELL_COPY.staleRpcRouter);
	expect(honoPlain.reason).toBe(CLIENT_SHELL_COPY.staleRpcRouter);
	expect(honoText.writeOutcome).toBe("Data was not written.");
	expect(honoText.retry).toBe("Retry");
});

test("a defined handler Not Found keeps Not Found", () => {
	const presented = presentFailedMainFlow({
		code: "NOT_FOUND",
		data: issueMainFlowFailure({
			reason: "Not Found",
			trackingId: "CANT-DEFINED1",
			written: false,
		}),
		defined: true,
		message: "Not Found",
		status: 404,
	});

	expect(presented.reason).toBe("Not Found");
	expect(presented.supportReference).toBe("CANT-DEFINED1");
});
