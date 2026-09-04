/**
 * Research Sessions seam — Project ana kayıt with purpose, guide,
 * optional time, and consent. Not asked / Not allowed close attributed
 * quotes, identifying personal notes, File Attachments, and share/publish.
 * Later Allowed or a wider snapshot does not reopen blocked bytes.
 * docs/specs/43-research-sessions/spec.md and GitHub #307.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Hesap ve kişisel veri / Kişisel veri fixture).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";

import {
	attachFileToSession,
	convertToNewRecord,
	createResearchSession,
	freezePublishedSnapshot,
	getResearchSession,
	includeInShare,
	listResearchSessions,
	personalDataResearchConsentFixture,
	previewClosedWorld,
	resolvePublishedSnapshot,
	setConsent,
	setParticipant,
	setStatus,
	writeAttributedQuote,
	writeIdentifyingPersonalNote,
} from "./research-sessions";
import {
	CLOSED_WORLD_ITEM_KIND,
	CONSENT,
	KISISEL_VERI_FIXTURE,
	NOTE_KIND,
	RESEARCH_SESSION_STATUS,
	RESEARCH_SESSIONS_COPY,
} from "./research-sessions-model";

const DATABASE_URL = localTestDatabaseUrl();

const CALENDAR_OR_CRM =
	/invite|attendance|CRM stage|research score|calendar event/i;
const LEGAL_JUDGMENT = /GDPR|lawful basis|certified compliant/i;
const FEEDBACK_OR_TEST = /Feedback|Test Session/;
const SPEAKER_OR_COUNT = /speaker|count|1 quote/i;

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
	await prisma.researchSession.deleteMany();
	await prisma.typedRelation.deleteMany();
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

async function committedSession(
	prisma: PrismaClient,
	input: {
		actorId: string;
		consent?: (typeof CONSENT)[keyof typeof CONSENT];
		contactId?: string | null;
		idempotencyKey: string;
		projectId: string;
		title?: string;
	}
) {
	const created = await createResearchSession(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			channel: "Interview",
			consent: input.consent,
			contactId: input.contactId,
			facilitator: "Founder",
			projectId: input.projectId,
			purpose: "Learn why checkout stalls.",
			questionGuide: "What blocked pay?",
			scopeNote: "One merchant.",
			title: input.title ?? "Checkout interview",
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected create");
	}
	return created.session;
}

async function expectClosedGates(
	prisma: PrismaClient,
	input: {
		actorId: string;
		consent: typeof CONSENT.notAsked | typeof CONSENT.notAllowed;
		projectId: string;
	}
) {
	const session = await committedSession(prisma, {
		actorId: input.actorId,
		consent: input.consent,
		idempotencyKey: `closed-${input.consent}`,
		projectId: input.projectId,
		title: input.consent,
	});
	const quote = await writeAttributedQuote(prisma, {
		actorId: input.actorId,
		baseRevision: session.revision,
		idempotencyKey: `quote-${input.consent}`,
		origin: "human",
		payload: {
			body: "The pay button did nothing.",
			sessionId: session.id,
			speakerLabel: "Maya Chen",
		},
	});
	expect(quote).toEqual({
		reason: "consent-gates-closed",
		status: "rejected",
	});
	const note = await writeIdentifyingPersonalNote(prisma, {
		actorId: input.actorId,
		baseRevision: session.revision,
		idempotencyKey: `note-${input.consent}`,
		origin: "human",
		payload: {
			body: "Lives on Oak Street.",
			sessionId: session.id,
		},
	});
	expect(note.status).toBe("rejected");
	if (note.status === "rejected") {
		expect(note.reason).toBe("consent-gates-closed");
	}
	const file = await attachFileToSession(prisma, {
		actorId: input.actorId,
		baseRevision: session.revision,
		idempotencyKey: `file-${input.consent}`,
		origin: "human",
		payload: {
			fileAttachmentId: crypto.randomUUID(),
			sessionId: session.id,
		},
	});
	expect(file.status).toBe("rejected");
	if (file.status === "rejected") {
		expect(file.reason).toBe("consent-gates-closed");
	}
	const convert = await convertToNewRecord(prisma, {
		actorId: input.actorId,
		idempotencyKey: `convert-${input.consent}`,
		origin: "human",
		payload: { previewAcknowledged: true, sessionId: session.id },
	});
	expect(convert).toEqual({
		reason: "consent-gates-closed",
		status: "rejected",
	});
	const share = await includeInShare(prisma, {
		actorId: input.actorId,
		idempotencyKey: `share-${input.consent}`,
		origin: "human",
		payload: { itemId: "quote-missing", sessionId: session.id },
	});
	expect(share).toEqual({
		reason: "consent-gates-closed",
		status: "rejected",
	});
	const live = await getResearchSession(prisma, session.id);
	expect(live?.notes).toEqual([]);
	expect(live?.files).toEqual([]);
}

async function expectOpenGates(
	prisma: PrismaClient,
	input: {
		actorId: string;
		consent: typeof CONSENT.allowed | typeof CONSENT.notApplicable;
		projectId: string;
	}
) {
	const session = await committedSession(prisma, {
		actorId: input.actorId,
		consent: input.consent,
		idempotencyKey: `open-${input.consent}`,
		projectId: input.projectId,
		title: input.consent,
	});
	expect(session.consentGatesOpen).toBe(true);
	const quote = await writeAttributedQuote(prisma, {
		actorId: input.actorId,
		baseRevision: session.revision,
		idempotencyKey: `quote-ok-${input.consent}`,
		origin: "human",
		payload: {
			body: "I waited then left.",
			sessionId: session.id,
			speakerLabel: "Sam",
		},
	});
	expect(quote.status).toBe("committed");
	if (quote.status !== "committed") {
		return;
	}
	expect(quote.session.notes[0]?.kind).toBe(NOTE_KIND.participantQuote);
	expect(quote.session.notes[0]?.speakerLabel).toBe("Sam");
	const convert = await convertToNewRecord(prisma, {
		actorId: input.actorId,
		idempotencyKey: `convert-open-${input.consent}`,
		origin: "human",
		payload: { sessionId: session.id },
	});
	expect(convert).toEqual({
		reason: "preview-required",
		status: "rejected",
	});
	const preview = await previewClosedWorld(prisma, session.id);
	expect(preview.some((item) => item.kind === "Participant quote")).toBe(true);
	const quoteItem = preview.find(
		(item) => item.kind === CLOSED_WORLD_ITEM_KIND.participantQuote
	);
	expect(quoteItem).toBeDefined();
	if (quoteItem?.kind !== CLOSED_WORLD_ITEM_KIND.participantQuote) {
		return;
	}
	const shared = await includeInShare(prisma, {
		actorId: input.actorId,
		idempotencyKey: `share-ok-${input.consent}`,
		origin: "human",
		payload: { itemId: quoteItem.id, sessionId: session.id },
	});
	expect(shared).toEqual({ included: true, status: "committed" });
}

describe("Research Sessions", () => {
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

	it("creates a Research Session as a Project record that is Planned", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const when = "2026-09-04T12:00:00.000Z";
		const outcome = await createResearchSession(prisma, {
			actorId,
			idempotencyKey: "create-checkout-session",
			origin: "human",
			payload: {
				channel: "Interview",
				durationMinutes: 45,
				facilitator: "Founder",
				projectId,
				purpose: "Learn why checkout stalls.",
				questionGuide: "What blocked pay?",
				scheduledAt: when,
				scopeNote: "One merchant.",
				title: "Checkout interview",
			},
		});
		expect(outcome.status).toBe("committed");
		if (outcome.status !== "committed") {
			return;
		}
		expect(outcome.session.recordKind).toBe(
			RESEARCH_SESSIONS_COPY.researchSession
		);
		expect(outcome.session.status).toBe(RESEARCH_SESSION_STATUS.planned);
		expect(outcome.session.consent).toBe(CONSENT.notAsked);
		expect(outcome.session.consentGatesOpen).toBe(false);
		expect(outcome.session.purpose).toBe("Learn why checkout stalls.");
		expect(outcome.session.questionGuide).toBe("What blocked pay?");
		expect(outcome.session.scheduledAt).toBe(when);
		expect(outcome.session.durationMinutes).toBe(45);
		expect(outcome.session.contactId).toBeNull();
		expect(outcome.session.consentRecordedByUserId).toBe(actorId);
		expect(outcome.session.consentIsNotLegalJudgment).toBe(
			RESEARCH_SESSIONS_COPY.consentIsNotLegalJudgment
		);
		expect(outcome.session.youRemainResponsible).toBe(
			RESEARCH_SESSIONS_COPY.youRemainResponsible
		);
		expect(JSON.stringify(outcome.session)).not.toMatch(CALENDAR_OR_CRM);
		expect(JSON.stringify(outcome.session)).not.toMatch(LEGAL_JUDGMENT);
		expect(JSON.stringify(outcome.session)).not.toMatch(FEEDBACK_OR_TEST);
		const listed = await listResearchSessions(prisma, projectId);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(outcome.session.id);
	});

	it("links a known participant Contact without forcing one", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const contactId = crypto.randomUUID();
		const linked = await committedSession(prisma, {
			actorId,
			contactId,
			idempotencyKey: "with-contact",
			projectId,
		});
		expect(linked.contactId).toBe(contactId);
		const unknown = await committedSession(prisma, {
			actorId,
			idempotencyKey: "without-contact",
			projectId,
			title: "Unknown merchant",
		});
		expect(unknown.contactId).toBeNull();
		const cleared = await setParticipant(prisma, {
			actorId,
			baseRevision: linked.revision,
			idempotencyKey: "clear-contact",
			origin: "human",
			payload: { contactId: null, sessionId: linked.id },
		});
		expect(cleared.status).toBe("committed");
		if (cleared.status !== "committed") {
			return;
		}
		expect(cleared.session.contactId).toBeNull();
	});

	it("sets Planned Completed and Cancelled without a calendar invite", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			idempotencyKey: "status-session",
			projectId,
		});
		const completed = await setStatus(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "complete",
			origin: "human",
			payload: {
				sessionId: session.id,
				status: RESEARCH_SESSION_STATUS.completed,
			},
		});
		expect(completed.status).toBe("committed");
		if (completed.status !== "committed") {
			return;
		}
		expect(completed.session.status).toBe(RESEARCH_SESSION_STATUS.completed);
		expect(JSON.stringify(completed.session)).not.toMatch(CALENDAR_OR_CRM);
		const cancelled = await setStatus(prisma, {
			actorId,
			baseRevision: completed.session.revision,
			idempotencyKey: "cancel",
			origin: "human",
			payload: {
				sessionId: session.id,
				status: RESEARCH_SESSION_STATUS.cancelled,
			},
		});
		expect(cancelled.status).toBe("committed");
		if (cancelled.status !== "committed") {
			return;
		}
		expect(cancelled.session.status).toBe(RESEARCH_SESSION_STATUS.cancelled);
	});

	it("keeps quote identifying note file and share closed for Not asked and Not allowed", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		await expectClosedGates(prisma, {
			actorId,
			consent: CONSENT.notAsked,
			projectId,
		});
		await expectClosedGates(prisma, {
			actorId,
			consent: CONSENT.notAllowed,
			projectId,
		});
	});

	it("opens quote file and share for Allowed and Not applicable but still requires convert preview", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		await expectOpenGates(prisma, {
			actorId,
			consent: CONSENT.allowed,
			projectId,
		});
		await expectOpenGates(prisma, {
			actorId,
			consent: CONSENT.notApplicable,
			projectId,
		});
	});

	it("does not invent blocked quotes after a later Allowed", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.notAllowed,
			idempotencyKey: "later-allowed",
			projectId,
		});
		await writeAttributedQuote(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "blocked-quote",
			origin: "human",
			payload: {
				body: "Secret line.",
				sessionId: session.id,
				speakerLabel: "Maya Chen",
			},
		});
		const opened = await setConsent(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "widen-consent",
			origin: "human",
			payload: { consent: CONSENT.allowed, sessionId: session.id },
		});
		expect(opened.status).toBe("committed");
		if (opened.status !== "committed") {
			return;
		}
		expect(opened.session.consent).toBe(CONSENT.allowed);
		expect(opened.session.notes).toEqual([]);
		const preview = await previewClosedWorld(prisma, session.id);
		expect(JSON.stringify(preview)).not.toContain("Secret line");
		expect(JSON.stringify(preview)).not.toContain("Maya Chen");
		expect(preview.filter((item) => item.kind === "Participant quote")).toEqual(
			[]
		);
	});

	it("keeps a frozen snapshot from leaking unconsented speaker labels counts or relation hints", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const contactId = "contact-maya-chen";
		const fileId = "file-secret-audio";
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.notAllowed,
			contactId,
			idempotencyKey: "snapshot-closed",
			projectId,
		});
		const closedPreview = await previewClosedWorld(prisma, session.id);
		expect(closedPreview.map((item) => item.kind).sort()).toEqual(
			[
				CLOSED_WORLD_ITEM_KIND.consent,
				CLOSED_WORLD_ITEM_KIND.researchSession,
			].sort()
		);
		const closedJson = JSON.stringify(closedPreview);
		expect(closedJson).not.toContain("Maya Chen");
		expect(closedJson).not.toContain(contactId);
		expect(closedJson).not.toContain(fileId);
		expect(closedJson).not.toMatch(SPEAKER_OR_COUNT);
		const snapshot = freezePublishedSnapshot(closedPreview, session);
		const opened = await setConsent(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "open-after-freeze",
			origin: "human",
			payload: { consent: CONSENT.allowed, sessionId: session.id },
		});
		if (opened.status !== "committed") {
			throw new Error("expected consent");
		}
		const quote = await writeAttributedQuote(prisma, {
			actorId,
			baseRevision: opened.session.revision,
			idempotencyKey: "after-freeze-quote",
			origin: "human",
			payload: {
				body: "I tapped twice.",
				sessionId: session.id,
				speakerLabel: "Maya Chen",
			},
		});
		if (quote.status !== "committed") {
			throw new Error("expected quote");
		}
		await attachFileToSession(prisma, {
			actorId,
			baseRevision: quote.session.revision,
			idempotencyKey: "after-freeze-file",
			origin: "human",
			payload: { fileAttachmentId: fileId, sessionId: session.id },
		});
		const live = await previewClosedWorld(prisma, session.id);
		expect(live.some((item) => item.kind === "Participant quote")).toBe(true);
		const resolved = resolvePublishedSnapshot(snapshot, live);
		expect(resolved.silentlyUpdated).toBe(false);
		expect(resolved.redirected).toBe(false);
		const resolvedJson = JSON.stringify(resolved.items);
		expect(resolvedJson).not.toContain("Maya Chen");
		expect(resolvedJson).not.toContain("I tapped twice");
		expect(resolvedJson).not.toContain(fileId);
		expect(resolvedJson).not.toContain(contactId);
		expect(resolved.items).toHaveLength(snapshot.includedItemIds.length);
	});

	it("includes every consent value in the Kişisel veri fixture", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const fixture = await personalDataResearchConsentFixture(prisma, {
			actorId,
			projectId,
		});
		expect(KISISEL_VERI_FIXTURE.name).toBe("Kişisel veri");
		expect(fixture.map((row) => row.consent)).toEqual([
			CONSENT.notAsked,
			CONSENT.allowed,
			CONSENT.notAllowed,
			CONSENT.notApplicable,
		]);
		expect(JSON.stringify(RESEARCH_SESSIONS_COPY)).not.toMatch(LEGAL_JUDGMENT);
		expect(RESEARCH_SESSIONS_COPY.researchSession).toBe("Research Session");
		expect(RESEARCH_SESSIONS_COPY.notAsked).toBe("Not asked");
		expect(RESEARCH_SESSIONS_COPY.allowed).toBe("Allowed");
		expect(RESEARCH_SESSIONS_COPY.notAllowed).toBe("Not allowed");
		expect(RESEARCH_SESSIONS_COPY.notApplicable).toBe("Not applicable");
	});
});
