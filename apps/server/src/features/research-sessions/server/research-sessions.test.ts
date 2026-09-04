/**
 * Research Sessions seam — Project ana kayıt with purpose, guide,
 * optional time, and consent. Not asked / Not allowed close attributed
 * quotes, identifying personal notes, File Attachments, and share/publish.
 * Notes are typed Participant quote, Observation, and Founder interpretation.
 * Later Allowed or a wider snapshot does not reopen blocked bytes.
 * docs/specs/43-research-sessions/spec.md and GitHub #307 / #308 / #309.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Hesap ve kişisel veri / Kişisel veri fixture). Convert/pin is counterpart
 * evidence for Kanıt akışı; not tasarım bağlamı.
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { getWork, listWork } from "../../work-lifecycle/server/work-lifecycle";

import {
	attachFileToSession,
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
	updateNote,
	writeAttributedQuote,
	writeFounderInterpretation,
	writeObservation,
	writeTypedNote,
} from "./research-sessions";
import {
	convertToNewRecord,
	previewConvert,
	resolveEvidencePin,
} from "./research-sessions-convert";
import {
	CLOSED_WORLD_ITEM_KIND,
	CONSENT,
	CONVERT_TARGET_KINDS,
	KISISEL_VERI_FIXTURE,
	NOTE_KIND,
	RESEARCH_SESSION_STATUS,
	RESEARCH_SESSIONS_COPY,
} from "./research-sessions-model";

const DATABASE_URL = localTestDatabaseUrl();

const CALENDAR_OR_CRM =
	/invite|attendance|CRM stage|research score|calendar event/i;
const LEGAL_JUDGMENT = /GDPR|lawful basis|certified compliant/i;
const FEEDBACK_OR_TEST = /Feedback|Test Session|Validation Record/;
const SPEAKER_OR_COUNT = /speaker|count|1 quote/i;
const AUTO_THEME_OR_SENTIMENT =
	/sentiment|auto-learnings|auto theme|theme cluster/i;
const FILE_NOT_TRANSCRIPT_OR_BIND = /transcript|evidence bind/i;

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
	const observation = await writeObservation(prisma, {
		actorId: input.actorId,
		baseRevision: session.revision,
		idempotencyKey: `observation-${input.consent}`,
		origin: "human",
		payload: {
			body: "Paused on the pay button.",
			sessionId: session.id,
		},
	});
	expect(observation.status).toBe("rejected");
	if (observation.status === "rejected") {
		expect(observation.reason).toBe("consent-gates-closed");
	}
	const interpretation = await writeFounderInterpretation(prisma, {
		actorId: input.actorId,
		baseRevision: session.revision,
		idempotencyKey: `interpretation-${input.consent}`,
		origin: "human",
		payload: {
			body: "Checkout trust is the stall.",
			sessionId: session.id,
		},
	});
	expect(interpretation.status).toBe("rejected");
	if (interpretation.status === "rejected") {
		expect(interpretation.reason).toBe("consent-gates-closed");
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
	const shareSession = await includeInShare(prisma, {
		actorId: input.actorId,
		idempotencyKey: `share-session-${input.consent}`,
		origin: "human",
		payload: { itemId: session.id, sessionId: session.id },
	});
	expect(shareSession).toEqual({
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
	const observation = await writeObservation(prisma, {
		actorId: input.actorId,
		baseRevision: quote.session.revision,
		idempotencyKey: `observation-ok-${input.consent}`,
		origin: "human",
		payload: {
			body: "Hovered, then closed the tab.",
			sessionId: session.id,
		},
	});
	expect(observation.status).toBe("committed");
	if (observation.status !== "committed") {
		return;
	}
	expect(observation.session.notes[1]?.kind).toBe(NOTE_KIND.observation);
	const interpretation = await writeFounderInterpretation(prisma, {
		actorId: input.actorId,
		baseRevision: observation.session.revision,
		idempotencyKey: `interpretation-ok-${input.consent}`,
		origin: "human",
		payload: {
			body: "The stall is a trust gap.",
			sessionId: session.id,
		},
	});
	expect(interpretation.status).toBe("committed");
	if (interpretation.status !== "committed") {
		return;
	}
	expect(interpretation.session.notes[2]?.kind).toBe(
		NOTE_KIND.founderInterpretation
	);
	expect(interpretation.session.notes[2]?.kind).not.toBe(
		NOTE_KIND.participantQuote
	);
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
		const allowed = fixture.find((row) => row.consent === CONSENT.allowed);
		expect(allowed?.notes[0]?.kind).toBe(NOTE_KIND.participantQuote);
		expect(allowed?.notes[0]?.body).toBe("The pay button did nothing.");
		const closed = fixture.find((row) => row.consent === CONSENT.notAsked);
		expect(closed?.notes).toEqual([]);
		const notApplicable = fixture.find(
			(row) => row.consent === CONSENT.notApplicable
		);
		expect(notApplicable?.notes[0]?.kind).toBe(NOTE_KIND.observation);
		expect(JSON.stringify(RESEARCH_SESSIONS_COPY)).not.toMatch(LEGAL_JUDGMENT);
		expect(RESEARCH_SESSIONS_COPY.researchSession).toBe("Research Session");
		expect(RESEARCH_SESSIONS_COPY.notAsked).toBe("Not asked");
		expect(RESEARCH_SESSIONS_COPY.allowed).toBe("Allowed");
		expect(RESEARCH_SESSIONS_COPY.notAllowed).toBe("Not allowed");
		expect(RESEARCH_SESSIONS_COPY.notApplicable).toBe("Not applicable");
		expect(RESEARCH_SESSIONS_COPY.participantQuote).toBe("Participant quote");
		expect(RESEARCH_SESSIONS_COPY.observation).toBe("Observation");
		expect(RESEARCH_SESSIONS_COPY.founderInterpretation).toBe(
			"Founder interpretation"
		);
	});

	it("refuses a mixed untyped note body and keeps the three kinds distinct", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.allowed,
			idempotencyKey: "typed-notes-session",
			projectId,
		});
		const mixed = await writeTypedNote(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "mixed-body",
			origin: "human",
			payload: {
				body: "She said the button failed and I think trust is broken.",
				sessionId: session.id,
			},
		});
		expect(mixed).toEqual({
			reason: "untyped-note-refused",
			status: "rejected",
		});
		const quote = await writeAttributedQuote(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "typed-quote",
			origin: "human",
			payload: {
				body: "The button failed.",
				sessionId: session.id,
				speakerLabel: "Maya",
			},
		});
		expect(quote.status).toBe("committed");
		if (quote.status !== "committed") {
			return;
		}
		const observation = await writeObservation(prisma, {
			actorId,
			baseRevision: quote.session.revision,
			idempotencyKey: "typed-observation",
			origin: "human",
			payload: { body: "Retried twice, then left.", sessionId: session.id },
		});
		expect(observation.status).toBe("committed");
		if (observation.status !== "committed") {
			return;
		}
		const interpretation = await writeFounderInterpretation(prisma, {
			actorId,
			baseRevision: observation.session.revision,
			idempotencyKey: "typed-interpretation",
			origin: "human",
			payload: {
				body: "Trust in the pay step is the stall.",
				sessionId: session.id,
			},
		});
		expect(interpretation.status).toBe("committed");
		if (interpretation.status !== "committed") {
			return;
		}
		const kinds = interpretation.session.notes.map((note) => note.kind);
		expect(kinds).toEqual([
			NOTE_KIND.participantQuote,
			NOTE_KIND.observation,
			NOTE_KIND.founderInterpretation,
		]);
		expect(new Set(kinds).size).toBe(3);
		expect(JSON.stringify(interpretation.session.notes)).not.toMatch(
			AUTO_THEME_OR_SENTIMENT
		);
		expect(JSON.stringify(interpretation.session)).not.toMatch(
			FEEDBACK_OR_TEST
		);
		expect(interpretation.session).not.toHaveProperty("themes");
		expect(interpretation.session).not.toHaveProperty("sentiment");
		expect(interpretation.session).not.toHaveProperty("autoLearnings");
	});

	it("does not label founder interpretation as a participant quote", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.allowed,
			idempotencyKey: "interpretation-not-quote",
			projectId,
		});
		const interpretation = await writeFounderInterpretation(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "founder-line",
			origin: "human",
			payload: {
				body: "I read this as a trust stall.",
				sessionId: session.id,
			},
		});
		expect(interpretation.status).toBe("committed");
		if (interpretation.status !== "committed") {
			return;
		}
		const [note] = interpretation.session.notes;
		expect(note?.kind).toBe(NOTE_KIND.founderInterpretation);
		expect(note?.kind).not.toBe(NOTE_KIND.participantQuote);
		expect(note?.speakerLabel).toBeNull();
		const preview = await previewClosedWorld(prisma, session.id);
		const quoteItems = preview.filter(
			(item) => item.kind === CLOSED_WORLD_ITEM_KIND.participantQuote
		);
		expect(quoteItems).toEqual([]);
		const interpretationItem = preview.find(
			(item) => item.kind === CLOSED_WORLD_ITEM_KIND.founderInterpretation
		);
		expect(interpretationItem?.kind).toBe(
			CLOSED_WORLD_ITEM_KIND.founderInterpretation
		);
		expect(JSON.stringify(preview)).not.toMatch(AUTO_THEME_OR_SENTIMENT);
	});

	it("keeps a speaker label from leaking Contact fields", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const contactId = "contact-maya-hidden-email";
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.allowed,
			contactId,
			idempotencyKey: "speaker-not-contact",
			projectId,
		});
		expect(session.contactId).toBe(contactId);
		expect(session.notes).toEqual([]);
		const quote = await writeAttributedQuote(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "quote-with-label",
			origin: "human",
			payload: {
				body: "I tapped twice.",
				sessionId: session.id,
				speakerLabel: "Maya",
			},
		});
		expect(quote.status).toBe("committed");
		if (quote.status !== "committed") {
			return;
		}
		expect(quote.session.notes[0]?.speakerLabel).toBe("Maya");
		expect(quote.session.notes[0]?.speakerLabel).not.toBe(contactId);
		expect(JSON.stringify(quote.session.notes[0])).not.toContain(contactId);
		const preview = await previewClosedWorld(prisma, session.id);
		const quoteItem = preview.find(
			(item) => item.kind === CLOSED_WORLD_ITEM_KIND.participantQuote
		);
		expect(quoteItem).toBeDefined();
		if (quoteItem?.kind !== CLOSED_WORLD_ITEM_KIND.participantQuote) {
			return;
		}
		expect(quoteItem.speakerLabel).toBe("Maya");
		expect(JSON.stringify(quoteItem)).not.toContain(contactId);
		const contactItem = preview.find(
			(item) => item.kind === CLOSED_WORLD_ITEM_KIND.contact
		);
		expect(contactItem?.kind).toBe(CLOSED_WORLD_ITEM_KIND.contact);
		const observationWithSpeaker = await writeObservation(prisma, {
			actorId,
			baseRevision: quote.session.revision,
			idempotencyKey: "observation-speaker",
			origin: "human",
			payload: {
				body: "Left the page.",
				sessionId: session.id,
				speakerLabel: "Maya Chen",
			},
		});
		expect(observationWithSpeaker).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
	});

	it("previews convert without creating a record until confirm", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.allowed,
			idempotencyKey: "convert-preview-session",
			projectId,
		});
		const quote = await writeAttributedQuote(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "convert-preview-quote",
			origin: "human",
			payload: {
				body: "The pay button did nothing.",
				sessionId: session.id,
				speakerLabel: "Maya",
			},
		});
		expect(quote.status).toBe("committed");
		if (quote.status !== "committed") {
			return;
		}
		const [note] = quote.session.notes;
		expect(note).toBeDefined();
		if (!note) {
			return;
		}
		const previewed = await previewConvert(prisma, {
			noteId: note.id,
			projectId,
			recordKind: "Work",
			sessionId: session.id,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			return;
		}
		expect(previewed.preview.label).toBe(
			RESEARCH_SESSIONS_COPY.convertToNewRecordAndBind
		);
		expect(previewed.preview.recordKind).toBe("Work");
		expect(previewed.preview.projectId).toBe(projectId);
		expect(previewed.preview.title).toBe("The pay button did nothing.");
		expect(previewed.preview.body).toBe("The pay button did nothing.");
		expect(previewed.preview.origin).toBe(RELATIONS_COPY.origin);
		expect(previewed.preview.versionPinnedEvidence).toBe(
			RESEARCH_SESSIONS_COPY.versionPinnedEvidence
		);
		expect(previewed.preview.sessionRevision).toBe(quote.session.revision);
		expect(previewed.preview.textRange).toEqual({
			end: "The pay button did nothing.".length,
			start: 0,
		});
		expect(CONVERT_TARGET_KINDS).toEqual([
			"Feedback",
			"Assumption",
			"Open Question",
			"Work",
			"Feature",
			"Decision",
		]);
		expect(previewed.preview).not.toHaveProperty("recordKindDefault");
		const worksBefore = (await listWork(prisma, projectId)).length;
		const skipped = await convertToNewRecord(prisma, {
			actorId,
			idempotencyKey: "convert-without-ack",
			origin: "human",
			payload: {
				noteId: note.id,
				previewFingerprint: previewed.preview.fingerprint,
				projectId,
				recordKind: "Work",
				sessionId: session.id,
			},
		});
		expect(skipped).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		expect((await listWork(prisma, projectId)).length).toBe(worksBefore);
		const untyped = await convertToNewRecord(prisma, {
			actorId,
			idempotencyKey: "convert-auto-type",
			origin: "human",
			payload: {
				noteId: note.id,
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				projectId,
				sessionId: session.id,
			},
		});
		expect(untyped).toEqual({
			reason: "type-required",
			status: "rejected",
		});
		expect((await listWork(prisma, projectId)).length).toBe(worksBefore);
	});

	it("converts one Work with origin and a pin that later note edits do not move", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.allowed,
			idempotencyKey: "convert-commit-session",
			projectId,
		});
		const quote = await writeAttributedQuote(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "convert-commit-quote",
			origin: "human",
			payload: {
				body: "Checkout trust stalled me.",
				sessionId: session.id,
				speakerLabel: "Sam",
			},
		});
		expect(quote.status).toBe("committed");
		if (quote.status !== "committed") {
			return;
		}
		const [note] = quote.session.notes;
		expect(note).toBeDefined();
		if (!note) {
			return;
		}
		const pinnedRevision = quote.session.revision;
		const previewed = await previewConvert(prisma, {
			noteId: note.id,
			projectId,
			recordKind: "Work",
			sessionId: session.id,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			return;
		}
		const converted = await convertToNewRecord(prisma, {
			actorId,
			baseRevision: quote.session.revision,
			idempotencyKey: "convert-commit",
			origin: "human",
			payload: {
				noteId: note.id,
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				projectId,
				recordKind: "Work",
				sessionId: session.id,
			},
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed") {
			return;
		}
		expect(converted.records).toHaveLength(1);
		expect(converted.records[0]?.kind).toBe("Work");
		expect(converted.session.notes).toHaveLength(1);
		expect(converted.session.notes[0]?.body).toBe("Checkout trust stalled me.");
		const work = await getWork(prisma, converted.records[0]?.id ?? "");
		expect(work?.title).toBe("Checkout trust stalled me.");
		const origin = await listRelations(prisma, {
			record: { id: work?.id ?? "", kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const originRow = origin.find((row) => row.type === RELATIONS_COPY.origin);
		expect(originRow?.from.id).toBe(session.id);
		expect(originRow?.from.kind).toBe("User Research Session");
		expect(originRow?.originLocation?.componentId).toBe(note.id);
		expect(originRow?.originLocation?.sourceVersion).toBe(
			String(pinnedRevision)
		);
		expect(originRow?.originLocation?.ownerId).toBe(session.id);
		const pin = await resolveEvidencePin(prisma, converted.pinId);
		expect(pin?.excerpt).toBe("Checkout trust stalled me.");
		expect(pin?.sessionRevision).toBe(pinnedRevision);
		expect(pin?.textRange).toEqual({
			end: "Checkout trust stalled me.".length,
			start: 0,
		});
		expect(pin?.targetId).toBe(work?.id);
		const edited = await updateNote(prisma, {
			actorId,
			baseRevision: converted.session.revision,
			idempotencyKey: "edit-after-pin",
			origin: "human",
			payload: {
				body: "I later rewrote this as a different complaint.",
				noteId: note.id,
				sessionId: session.id,
			},
		});
		expect(edited.status).toBe("committed");
		if (edited.status !== "committed") {
			return;
		}
		expect(edited.session.notes[0]?.body).toBe(
			"I later rewrote this as a different complaint."
		);
		expect(edited.session.revision).toBeGreaterThan(pinnedRevision);
		const stillPinned = await resolveEvidencePin(prisma, converted.pinId);
		expect(stillPinned?.excerpt).toBe("Checkout trust stalled me.");
		expect(stillPinned?.sessionRevision).toBe(pinnedRevision);
		expect(stillPinned?.textRange).toEqual({
			end: "Checkout trust stalled me.".length,
			start: 0,
		});
		expect(stillPinned?.noteId).toBe(note.id);
		const live = await getResearchSession(prisma, session.id);
		expect(live?.notes[0]?.body).not.toBe(stillPinned?.excerpt);
		expect(JSON.stringify(converted)).not.toMatch(AUTO_THEME_OR_SENTIMENT);
		expect(converted).not.toHaveProperty("audio");
		expect(converted).not.toHaveProperty("transcript");
		expect(converted).not.toHaveProperty("invite");
	});

	it("does not treat a File Attachment as a transcript or evidence bind", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const session = await committedSession(prisma, {
			actorId,
			consent: CONSENT.allowed,
			idempotencyKey: "file-not-evidence-session",
			projectId,
		});
		const attached = await attachFileToSession(prisma, {
			actorId,
			baseRevision: session.revision,
			idempotencyKey: "file-not-evidence",
			origin: "human",
			payload: {
				fileAttachmentId: "outside-recording.m4a",
				sessionId: session.id,
			},
		});
		expect(attached.status).toBe("committed");
		if (attached.status !== "committed") {
			return;
		}
		const fileId = attached.session.files[0]?.id;
		expect(fileId).toBeDefined();
		const previewed = await previewConvert(prisma, {
			noteId: fileId,
			projectId,
			recordKind: "Work",
			sessionId: session.id,
		});
		expect(previewed).toEqual({
			reason: "note-not-found",
			status: "rejected",
		});
		expect(attached.session.files[0]?.fileAttachmentId).toBe(
			"outside-recording.m4a"
		);
		expect(JSON.stringify(attached.session.files)).not.toMatch(
			FILE_NOT_TRANSCRIPT_OR_BIND
		);
	});
});
