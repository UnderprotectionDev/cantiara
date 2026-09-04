/**
 * Sources and Freshness seam — user-started Recheck source,
 * Source Check + candidate snapshot, compare without silent
 * rebind, per-use keep/rebind, and source-version-in-use.
 * docs/specs/44-sources-and-freshness/spec.md and GitHub #312.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt tazeliği).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDecision } from "../../decisions/server/decisions";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	createUsageLink,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { USAGE_KIND } from "../../relations/server/relations-model";
import { createRisk } from "../../risks/server/risks";
import {
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";

import type { IsolatedHopTransport, IsolatedHttpHop } from "./isolated-egress";
import { createSource } from "./sources";
import {
	bindSourceEvidenceUse,
	inspectSourceFreshness,
	keepSourceEvidenceUse,
	rebindSourceEvidenceUse,
} from "./sources-evidence";
import {
	SOURCE_CHECK_DISPOSITION,
	SOURCE_CHECK_FAILURE,
	SOURCE_VERSION_IN_USE_SIGNAL_ID,
	SOURCE_VERSION_IN_USE_SIGNAL_SECTION,
	SOURCES_COPY,
	SOURCES_COUNTERPARTS,
} from "./sources-model";
import {
	compareSourceCheck,
	keepCurrentSourceVersion,
	previewRecheck,
	recheckSource,
	saveCheckAsNewSourceVersion,
} from "./sources-recheck";

const DATABASE_URL = localTestDatabaseUrl();
const PUBLIC_IPV4 = "93.184.216.34";
const STRIPE_URL = "https://docs.stripe.com/payments/checkout";
const PIN_RANGE = "Checkout Session creates a payment page.";
const CANDIDATE_BODY = "Checkout Session now requires a customer.";
const FEED_COPY = /\bfeed\b/i;
const UPDATE_ALL = /update all|batch rebind|auto.?refresh/i;
const SHA256_HEX = /^[a-f0-9]{64}$/;

async function seedWorkspace(prisma: PrismaClient) {
	const user = await prisma.user.create({
		data: {
			email: `founder-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			id: crypto.randomUUID(),
			name: "Founder",
		},
	});
	const workspace = await prisma.workspace.create({
		data: {
			id: crypto.randomUUID(),
			name: "Workspace",
			ownerId: user.id,
		},
	});
	return { actorId: user.id, workspaceId: workspace.id };
}

async function resetSharedTables(prisma: PrismaClient) {
	await prisma.sourceEvidencePin.deleteMany();
	await prisma.sourceCheck.deleteMany();
	await prisma.sourceVersionInUseSignal.deleteMany();
	await prisma.usageLink.deleteMany();
	await prisma.usageHostEmbed.deleteMany();
	await prisma.typedRelation.deleteMany();
	await prisma.source.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.project.deleteMany();
	await prisma.accountPreference.deleteMany();
	await prisma.workspace.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function openPayments(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-payments-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected project");
	}
	return { actorId, projectId: created.project.id, workspaceId };
}

function htmlPage(body: string, title: string): string {
	return `<!doctype html><html><head><title>${title}</title><script>owned()</script></head><body><p>${body}</p></body></html>`;
}

function scriptedTransport(
	hops: Record<string, IsolatedHttpHop>
): IsolatedHopTransport {
	return {
		request: (url: URL): Promise<IsolatedHttpHop> => {
			const hop = hops[url.href];
			if (!hop) {
				throw new Error(`unexpected hop ${url.href}`);
			}
			return Promise.resolve(hop);
		},
		resolve: (): Promise<string[]> => Promise.resolve([PUBLIC_IPV4]),
	};
}

async function committedSource(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string }
) {
	const created = await createSource(prisma, {
		actorId: input.actorId,
		idempotencyKey: `source-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			accessedAt: "2026-03-02T09:15:00.000Z",
			capturedContent: PIN_RANGE,
			projectId: input.projectId,
			title: "Stripe Checkout",
			url: STRIPE_URL,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected source");
	}
	return created.source;
}

describe("Sources and Freshness recheck", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("stores a user-started Source Check and candidate without changing the approved version", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const source = await committedSource(prisma, { actorId, projectId });
		const preview = await previewRecheck(prisma, source.id);
		expect(preview).toEqual({
			approvedVersionNumber: 1,
			startUrl: STRIPE_URL,
			thirdPartyFetchWillOccur: true,
		});
		const checked = await recheckSource(
			prisma,
			{
				actorId,
				idempotencyKey: "recheck-stripe",
				origin: "human",
				payload: { sourceId: source.id },
			},
			{
				transport: scriptedTransport({
					[STRIPE_URL]: {
						body: htmlPage(CANDIDATE_BODY, "Stripe Checkout"),
						contentType: "text/html; charset=utf-8",
						status: 200,
					},
				}),
			}
		);
		expect(checked.status).toBe("committed");
		if (checked.status !== "committed") {
			throw new Error("expected check");
		}
		expect(checked.source.approvedVersionNumber).toBe(1);
		expect(checked.source.capturedContent).toBe(PIN_RANGE);
		expect(checked.check.presentsOldContentAsCurrent).toBe(false);
		expect(checked.check.httpResult).toBe("200");
		expect(checked.check.actorId).toBe(actorId);
		expect(checked.check.startUrl).toBe(STRIPE_URL);
		expect(checked.check.finalUrl).toBe(STRIPE_URL);
		expect(checked.check.fingerprint).toMatch(SHA256_HEX);
		expect(checked.check.candidate?.capturedContent).toContain(CANDIDATE_BODY);
		expect(checked.check.candidate?.capturedContent).not.toContain("owned()");
		expect(checked.check.disposition).toBe(SOURCE_CHECK_DISPOSITION.open);
		const freshness = await inspectSourceFreshness(prisma, source.id);
		expect(freshness?.source.approvedVersionNumber).toBe(1);
		expect(freshness?.checks).toHaveLength(1);
		expect(freshness?.signal).toBeNull();
	});

	it("keeps a failed check on the event and does not present old content as current", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const source = await committedSource(prisma, { actorId, projectId });
		const checked = await recheckSource(
			prisma,
			{
				actorId,
				idempotencyKey: "recheck-gone",
				origin: "human",
				payload: { sourceId: source.id },
			},
			{
				transport: scriptedTransport({
					[STRIPE_URL]: {
						body: htmlPage(PIN_RANGE, "Gone"),
						contentType: "text/html",
						status: 404,
					},
				}),
			}
		);
		expect(checked.status).toBe("committed");
		if (checked.status !== "committed") {
			throw new Error("expected check");
		}
		expect(checked.check.failureReason).toBe(SOURCE_CHECK_FAILURE.deleted);
		expect(checked.check.candidate).toBeNull();
		expect(checked.check.presentsOldContentAsCurrent).toBe(false);
		expect(checked.source.capturedContent).toBe(PIN_RANGE);
		expect(checked.source.approvedVersionNumber).toBe(1);
		const compare = await compareSourceCheck(prisma, checked.check.id);
		expect(compare?.candidateContent).toBeNull();
		expect(await inspectSourceFreshness(prisma, source.id)).toMatchObject({
			signal: null,
		});
	});

	it("Keep current version leaves the approved Source version unchanged", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const source = await committedSource(prisma, { actorId, projectId });
		const checked = await recheckSource(
			prisma,
			{
				actorId,
				idempotencyKey: "recheck-keep",
				origin: "human",
				payload: { sourceId: source.id },
			},
			{
				transport: scriptedTransport({
					[STRIPE_URL]: {
						body: htmlPage(CANDIDATE_BODY, "Stripe Checkout"),
						contentType: "text/html",
						status: 200,
					},
				}),
			}
		);
		if (checked.status !== "committed") {
			throw new Error("expected check");
		}
		const kept = await keepCurrentSourceVersion(prisma, {
			actorId,
			idempotencyKey: "keep-version",
			origin: "human",
			payload: { checkId: checked.check.id },
		});
		expect(kept.status).toBe("committed");
		if (kept.status !== "committed") {
			throw new Error("expected keep");
		}
		expect(kept.source.approvedVersionNumber).toBe(1);
		expect(kept.source.capturedContent).toBe(PIN_RANGE);
		expect(kept.check.disposition).toBe(SOURCE_CHECK_DISPOSITION.kept);
		expect(kept.check.candidate?.capturedContent).toContain(CANDIDATE_BODY);
	});

	it("follows Kanıt tazeliği: one Source, three targets, two versions, partial review", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, { actorId, projectId });
		const versionId = source.versions[0]?.id;
		if (!versionId) {
			throw new Error("expected version");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-checkout",
			origin: "human",
			payload: { projectId, title: "Checkout flow" },
		});
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: "decision-stripe",
			origin: "human",
			payload: {
				decision: "Use Stripe Checkout.",
				projectId,
				rationale: "Hosted payment page.",
				title: "Stripe",
			},
		});
		const risk = await createRisk(prisma, {
			actorId,
			idempotencyKey: "risk-outage",
			origin: "human",
			payload: {
				description: "Provider outage.",
				impact: "Payments stop.",
				probability: "Rare.",
				projectId,
				response: "Document a backup.",
				title: "Checkout outage",
			},
		});
		if (
			work.status !== "committed" ||
			decision.status !== "committed" ||
			risk.status !== "committed"
		) {
			throw new Error("expected targets");
		}
		const workStatus = work.work.status;
		const decisionLife = decision.decision.life;
		const riskStatus = risk.risk.status;
		const pinOutcomes = await Promise.all(
			[
				{ id: work.work.id, key: "pin-work", kind: "Work" as const },
				{
					id: decision.decision.id,
					key: "pin-decision",
					kind: "Decision" as const,
				},
				{ id: risk.risk.id, key: "pin-risk", kind: "Risk" as const },
			].map((target) =>
				bindSourceEvidenceUse(prisma, {
					actorId,
					idempotencyKey: target.key,
					origin: "human",
					payload: {
						rangeText: PIN_RANGE,
						sourceId: source.id,
						sourceVersionId: versionId,
						targetId: target.id,
						targetKind: target.kind,
						viewerWorkspaceId: workspaceId,
					},
				})
			)
		);
		expect(pinOutcomes.every((bound) => bound.status === "committed")).toBe(
			true
		);
		const related = await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: "related-not-evidence",
			origin: "human",
			previewAcknowledged: true,
			to: { id: work.work.id, kind: "Work" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("rejected");
		const otherWork = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-wallet",
			origin: "human",
			payload: { projectId, title: "Wallet" },
		});
		if (otherWork.status !== "committed") {
			throw new Error("expected other work");
		}
		await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: "related-wallet",
			origin: "human",
			previewAcknowledged: true,
			to: { id: otherWork.work.id, kind: "Work" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		await createUsageLink(prisma, {
			actorId,
			hostRecordId: work.work.id,
			idempotencyKey: "live-card",
			kind: USAGE_KIND.liveContentBlock,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		const checked = await recheckSource(
			prisma,
			{
				actorId,
				idempotencyKey: "recheck-journey",
				origin: "human",
				payload: { sourceId: source.id },
			},
			{
				transport: scriptedTransport({
					[STRIPE_URL]: {
						body: htmlPage(CANDIDATE_BODY, "Stripe Checkout"),
						contentType: "text/html",
						status: 200,
					},
				}),
			}
		);
		if (checked.status !== "committed") {
			throw new Error("expected check");
		}
		const compare = await compareSourceCheck(prisma, checked.check.id);
		expect(compare?.copy.noMatchInCandidateVersion).toBe(
			"No match in candidate version"
		);
		expect(compare?.pinMatches).toHaveLength(3);
		expect(compare?.pinMatches.every((pin) => pin.match === "none")).toBe(true);
		const saved = await saveCheckAsNewSourceVersion(prisma, {
			actorId,
			baseRevision: checked.source.revision,
			idempotencyKey: "save-v2",
			origin: "human",
			payload: { checkId: checked.check.id },
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected save");
		}
		expect(saved.source.approvedVersionNumber).toBe(2);
		expect(saved.source.versions).toHaveLength(2);
		expect(saved.source.versions[0]?.capturedContent).toBe(PIN_RANGE);
		expect(saved.check.disposition).toBe(SOURCE_CHECK_DISPOSITION.saved);
		const afterSave = await inspectSourceFreshness(prisma, source.id);
		expect(afterSave?.uses).toHaveLength(3);
		expect(
			afterSave?.uses.every(
				(use) =>
					use.sourceVersionNumber === 1 &&
					use.accessedAt === "2026-03-02T09:15:00.000Z" &&
					use.rangeText === PIN_RANGE &&
					use.newerSourceVersionExists
			)
		).toBe(true);
		expect(afterSave?.signal?.signalId).toBe(SOURCE_VERSION_IN_USE_SIGNAL_ID);
		expect(afterSave?.signal?.section).toBe(
			SOURCE_VERSION_IN_USE_SIGNAL_SECTION
		);
		expect(afterSave?.signal?.uses).toHaveLength(3);
		const loadedWork = await getWork(prisma, work.work.id);
		expect(loadedWork?.status).toBe(workStatus);
		expect(loadedWork?.status).toBe(WORK_STATUS.notStarted);
		const listed = await listWork(prisma, projectId);
		expect(listed.map((item) => item.title).sort()).toEqual([
			"Checkout flow",
			"Wallet",
		]);
		const workUse = afterSave?.uses.find((use) => use.targetKind === "Work");
		const decisionUse = afterSave?.uses.find(
			(use) => use.targetKind === "Decision"
		);
		const riskUse = afterSave?.uses.find((use) => use.targetKind === "Risk");
		if (!(workUse && decisionUse && riskUse)) {
			throw new Error("expected three uses");
		}
		const rebound = await rebindSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "rebind-work",
			origin: "human",
			payload: { pinId: workUse.id },
		});
		expect(rebound.status).toBe("rejected");
		if (rebound.status === "rejected") {
			expect(rebound.reason).toBe("no-match-in-candidate-version");
			expect(rebound.copy?.noMatchInCandidateVersion).toBe(
				"No match in candidate version"
			);
		}
		const keptWork = await keepSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "keep-work",
			origin: "human",
			payload: { pinId: workUse.id },
		});
		expect(keptWork.status).toBe("committed");
		if (keptWork.status !== "committed") {
			throw new Error("expected keep use");
		}
		expect(
			keptWork.freshness.uses.find((use) => use.id === workUse.id)?.reviewed
		).toBe(true);
		expect(
			keptWork.freshness.uses.find((use) => use.id === decisionUse.id)?.reviewed
		).toBe(false);
		expect(
			keptWork.freshness.uses.find((use) => use.id === riskUse.id)?.reviewed
		).toBe(false);
		expect(
			keptWork.freshness.uses.find((use) => use.id === decisionUse.id)
				?.sourceVersionNumber
		).toBe(1);
		expect(keptWork.freshness.signal?.uses).toHaveLength(2);
		const keptDecision = await keepSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "keep-decision",
			origin: "human",
			payload: { pinId: decisionUse.id },
		});
		const keptRisk = await keepSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "keep-risk",
			origin: "human",
			payload: { pinId: riskUse.id },
		});
		expect(keptDecision.status).toBe("committed");
		expect(keptRisk.status).toBe("committed");
		if (keptRisk.status !== "committed") {
			throw new Error("expected last keep");
		}
		expect(keptRisk.freshness.signal).toBeNull();
		expect(
			keptRisk.freshness.uses.every((use) => use.sourceVersionNumber === 1)
		).toBe(true);
		expect(SOURCES_COUNTERPARTS.batchRebind).toBe(false);
		expect(SOURCES_COUNTERPARTS.autoImpact).toBe(false);
		expect(SOURCES_COUNTERPARTS.backgroundPoll).toBe(false);
		expect(decisionLife).toBe("Valid");
		expect(riskStatus).toBe("Open");
	});

	it("uses English recheck labels and has no update-all or background poll", () => {
		expect(SOURCES_COPY.recheckSource).toBe("Recheck source");
		expect(SOURCES_COPY.keepCurrentVersion).toBe("Keep current version");
		expect(SOURCES_COPY.saveAsNewSourceVersion).toBe(
			"Save as new Source version"
		);
		expect(SOURCES_COPY.newerSourceVersionExists).toBe(
			"Newer Source version exists"
		);
		expect(SOURCES_COPY.reviewedKeepCurrentVersion).toBe(
			"Reviewed; keep current version"
		);
		expect(SOURCES_COPY.rebindToNewVersion).toBe("Rebind to new version");
		expect(SOURCES_COPY.noMatchInCandidateVersion).toBe(
			"No match in candidate version"
		);
		expect(SOURCES_COPY.sourceCheck).toBe("Source Check");
		expect(JSON.stringify(SOURCES_COPY)).not.toMatch(FEED_COPY);
		expect(JSON.stringify(SOURCES_COPY)).not.toMatch(UPDATE_ALL);
	});

	it("rebinds only that evidence use when the range matches the new version", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, { actorId, projectId });
		const versionId = source.versions[0]?.id;
		if (!versionId) {
			throw new Error("expected version");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-match",
			origin: "human",
			payload: { projectId, title: "Checkout flow" },
		});
		const other = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-other",
			origin: "human",
			payload: { projectId, title: "Wallet" },
		});
		if (work.status !== "committed" || other.status !== "committed") {
			throw new Error("expected work");
		}
		await bindSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "pin-match",
			origin: "human",
			payload: {
				rangeText: PIN_RANGE,
				sourceId: source.id,
				sourceVersionId: versionId,
				targetId: work.work.id,
				targetKind: "Work",
				viewerWorkspaceId: workspaceId,
			},
		});
		await bindSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "pin-other",
			origin: "human",
			payload: {
				rangeText: PIN_RANGE,
				sourceId: source.id,
				sourceVersionId: versionId,
				targetId: other.work.id,
				targetKind: "Work",
				viewerWorkspaceId: workspaceId,
			},
		});
		const checked = await recheckSource(
			prisma,
			{
				actorId,
				idempotencyKey: "recheck-match",
				origin: "human",
				payload: { sourceId: source.id },
			},
			{
				transport: scriptedTransport({
					[STRIPE_URL]: {
						body: htmlPage(`${PIN_RANGE} Extra note.`, "Stripe Checkout"),
						contentType: "text/html",
						status: 200,
					},
				}),
			}
		);
		if (checked.status !== "committed") {
			throw new Error("expected check");
		}
		const compare = await compareSourceCheck(prisma, checked.check.id);
		expect(compare?.pinMatches.every((pin) => pin.match === "exact")).toBe(
			true
		);
		const saved = await saveCheckAsNewSourceVersion(prisma, {
			actorId,
			baseRevision: checked.source.revision,
			idempotencyKey: "save-match",
			origin: "human",
			payload: { checkId: checked.check.id },
		});
		if (saved.status !== "committed") {
			throw new Error("expected save");
		}
		const freshness = await inspectSourceFreshness(prisma, source.id);
		const first = freshness?.uses.find((use) => use.targetId === work.work.id);
		const second = freshness?.uses.find(
			(use) => use.targetId === other.work.id
		);
		if (!(first && second)) {
			throw new Error("expected uses");
		}
		const rebound = await rebindSourceEvidenceUse(prisma, {
			actorId,
			idempotencyKey: "rebind-match",
			origin: "human",
			payload: { pinId: first.id },
		});
		expect(rebound.status).toBe("committed");
		if (rebound.status !== "committed") {
			throw new Error("expected rebind");
		}
		expect(
			rebound.freshness.uses.find((use) => use.id === first.id)
				?.sourceVersionNumber
		).toBe(2);
		expect(
			rebound.freshness.uses.find((use) => use.id === second.id)
				?.sourceVersionNumber
		).toBe(1);
		expect(rebound.freshness.signal?.uses).toHaveLength(1);
	});
});
