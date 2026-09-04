import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import {
	attachFileCommandSchema,
	CLOSED_WORLD_ITEM_KIND,
	type ClosedWorldItem,
	CONSENT,
	type ConsentValue,
	type CreateResearchSessionCommand,
	consentGatesOpen,
	createResearchSessionCommandSchema,
	type IncludeInShareOutcome,
	includeInShareCommandSchema,
	NOTE_KIND,
	type NoteKind,
	type PublishedSnapshot,
	RESEARCH_SESSION_EVENT_KIND,
	RESEARCH_SESSION_STATUS,
	RESEARCH_SESSIONS_COPY,
	type ResearchSessionStatus,
	type ResearchSessionView,
	type ResearchSessionWriteOutcome,
	type ResolvePublishedSnapshotOutcome,
	setConsentCommandSchema,
	setParticipantCommandSchema,
	setStatusCommandSchema,
	updateNoteCommandSchema,
	writeNoteCommandSchema,
} from "./research-sessions-model";

type PrismaTransaction = Prisma.TransactionClient;

interface SessionRow {
	channel: string;
	consent: string;
	consentNote: string;
	consentRecordedAt: Date;
	consentRecordedByUserId: string;
	contactId: string | null;
	durationMinutes: number | null;
	facilitator: string;
	id: string;
	projectId: string;
	purpose: string;
	questionGuide: string;
	revision: number;
	scheduledAt: Date | null;
	scopeNote: string;
	status: string;
	title: string;
}

interface NoteRow {
	body: string;
	capturedUnderConsent: string;
	id: string;
	kind: string;
	speakerLabel: string | null;
}

interface FileRow {
	capturedUnderConsent: string;
	fileAttachmentId: string;
	id: string;
}

export async function createResearchSession(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	const parsed = createResearchSessionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await writeCreate(prisma, parsed.data);
}

export async function setConsent(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	const parsed = setConsentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setConsentInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setStatus(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	const parsed = setStatusCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateSessionField(tx, {
			actorId: parsed.data.actorId,
			baseRevision: parsed.data.baseRevision,
			commandKey,
			eventKind: RESEARCH_SESSION_EVENT_KIND.setStatus,
			fingerprint,
			next: parsed.data.payload.status,
			patch: { status: parsed.data.payload.status },
			sessionId: parsed.data.payload.sessionId,
		})
	);
}

export async function setParticipant(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	const parsed = setParticipantCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateSessionField(tx, {
			actorId: parsed.data.actorId,
			baseRevision: parsed.data.baseRevision,
			commandKey,
			eventKind: RESEARCH_SESSION_EVENT_KIND.setParticipant,
			fingerprint,
			next: parsed.data.payload.contactId,
			patch: { contactId: parsed.data.payload.contactId },
			sessionId: parsed.data.payload.sessionId,
		})
	);
}

export async function writeAttributedQuote(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	return await writeNote(prisma, command, NOTE_KIND.participantQuote);
}

export async function writeObservation(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	return await writeNote(prisma, command, NOTE_KIND.observation);
}

export async function writeFounderInterpretation(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	return await writeNote(prisma, command, NOTE_KIND.founderInterpretation);
}

export async function writeTypedNote(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	return await writeNote(prisma, command);
}

export async function attachFileToSession(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	const parsed = attachFileCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		attachFileInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function updateNote(
	prisma: PrismaClient,
	command: unknown
): Promise<ResearchSessionWriteOutcome> {
	const parsed = updateNoteCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const current = await tx.researchSession.findUnique({
			where: { id: parsed.data.payload.sessionId },
		});
		if (!current) {
			return { reason: "session-not-found", status: "rejected" };
		}
		await lockProject(tx, current.projectId);
		const replayed = await replayOrConflict(tx, commandKey, fingerprint);
		if (replayed) {
			return replayed;
		}
		const locked = await tx.researchSession.findUnique({
			where: { id: current.id },
		});
		if (!locked) {
			return { reason: "session-not-found", status: "rejected" };
		}
		if (locked.revision !== parsed.data.baseRevision) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const consent = presentConsent(locked.consent);
		if (!consentGatesOpen(consent)) {
			return { reason: "consent-gates-closed", status: "rejected" };
		}
		const note = await tx.researchSessionNote.findFirst({
			where: {
				id: parsed.data.payload.noteId,
				sessionId: locked.id,
			},
		});
		if (!note) {
			return { reason: "note-not-found", status: "rejected" };
		}
		await tx.researchSessionNote.update({
			data: { body: parsed.data.payload.body },
			where: { id: note.id },
		});
		await tx.researchSessionEvent.create({
			data: {
				actorId: parsed.data.actorId,
				id: crypto.randomUUID(),
				kind: RESEARCH_SESSION_EVENT_KIND.updateNote,
				next: parsed.data.payload.body,
				previous: note.body,
				sessionId: locked.id,
			},
		});
		const updated = await tx.researchSession.update({
			data: { revision: locked.revision + 1 },
			where: { id: locked.id },
		});
		const view = await hydrateOne(tx, updated);
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { session: view, status: "committed" };
	});
}

export async function includeInShare(
	prisma: PrismaClient,
	command: unknown
): Promise<IncludeInShareOutcome> {
	const parsed = includeInShareCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const view = await getResearchSession(prisma, parsed.data.payload.sessionId);
	if (!view) {
		return { reason: "session-not-found", status: "rejected" };
	}
	if (!view.consentGatesOpen) {
		return { reason: "consent-gates-closed", status: "rejected" };
	}
	const items = closedWorldItems(view);
	const match = items.find((item) => item.id === parsed.data.payload.itemId);
	if (!match) {
		return { reason: "consent-gates-closed", status: "rejected" };
	}
	return { included: true, status: "committed" };
}

export async function getResearchSession(
	prisma: PrismaClient | PrismaTransaction,
	sessionId: string
): Promise<ResearchSessionView | null> {
	const row = await prisma.researchSession.findUnique({
		where: { id: sessionId },
	});
	if (!row) {
		return null;
	}
	const [notes, files] = await Promise.all([
		prisma.researchSessionNote.findMany({
			orderBy: { createdAt: "asc" },
			where: { sessionId },
		}),
		prisma.researchSessionFile.findMany({
			orderBy: { createdAt: "asc" },
			where: { sessionId },
		}),
	]);
	return toView(row, notes, files);
}

export async function listResearchSessions(
	prisma: PrismaClient,
	projectId: string,
	query: { consent?: ConsentValue; status?: ResearchSessionStatus } = {}
): Promise<ResearchSessionView[]> {
	const rows = await prisma.researchSession.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			projectId,
			...(query.status ? { status: query.status } : {}),
			...(query.consent ? { consent: query.consent } : {}),
		},
	});
	return await hydrateViews(prisma, rows);
}

export async function searchResearchSessions(
	prisma: PrismaClient,
	query: { projectId: string; text: string }
): Promise<ResearchSessionView[]> {
	const listed = await listResearchSessions(prisma, query.projectId);
	const needle = query.text.trim().toLowerCase();
	if (needle.length === 0) {
		return listed;
	}
	return listed.filter(
		(view) =>
			view.title.toLowerCase().includes(needle) ||
			view.purpose.toLowerCase().includes(needle) ||
			view.questionGuide.toLowerCase().includes(needle)
	);
}

export async function previewClosedWorld(
	prisma: PrismaClient,
	sessionId: string
): Promise<ClosedWorldItem[]> {
	const view = await getResearchSession(prisma, sessionId);
	if (!view) {
		return [];
	}
	return closedWorldItems(view);
}

export function freezePublishedSnapshot(
	items: readonly ClosedWorldItem[],
	session: Pick<ResearchSessionView, "id" | "revision">
): PublishedSnapshot {
	return {
		includedItemIds: items.map((item) => item.id),
		includedItems: [...items],
		includedRevision: session.revision,
		sessionId: session.id,
	};
}

export function resolvePublishedSnapshot(
	snapshot: PublishedSnapshot,
	_liveItems: readonly ClosedWorldItem[]
): ResolvePublishedSnapshotOutcome {
	return {
		items: [...snapshot.includedItems],
		redirected: false,
		silentlyUpdated: false,
	};
}

export async function personalDataResearchConsentFixture(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string }
): Promise<ResearchSessionView[]> {
	const created = await Promise.all(
		[
			CONSENT.notAsked,
			CONSENT.allowed,
			CONSENT.notAllowed,
			CONSENT.notApplicable,
		].map((consent) =>
			createResearchSession(prisma, {
				actorId: input.actorId,
				idempotencyKey: `kisisel-veri-${consent}`,
				origin: "human",
				payload: {
					channel: "Interview",
					consent,
					consentNote: "",
					facilitator: "Founder",
					projectId: input.projectId,
					purpose: `${KISISEL_PURPOSE} ${consent}`,
					questionGuide: "What broke checkout?",
					scopeNote: "",
					title: `Kişisel veri · ${consent}`,
				},
			})
		)
	);
	const sessions = created.map((outcome) => {
		if (outcome.status !== "committed") {
			throw new Error("expected Kişisel veri fixture session");
		}
		return outcome.session;
	});
	return await attachAttributedNotesToKisiselVeriFixture(prisma, {
		actorId: input.actorId,
		sessions,
	});
}

async function attachAttributedNotesToKisiselVeriFixture(
	prisma: PrismaClient,
	input: { actorId: string; sessions: ResearchSessionView[] }
): Promise<ResearchSessionView[]> {
	const allowed = input.sessions.find(
		(session) => session.consent === CONSENT.allowed
	);
	const notApplicable = input.sessions.find(
		(session) => session.consent === CONSENT.notApplicable
	);
	if (allowed) {
		const quote = await writeAttributedQuote(prisma, {
			actorId: input.actorId,
			baseRevision: allowed.revision,
			idempotencyKey: "kisisel-veri-allowed-quote",
			origin: "human",
			payload: {
				body: "The pay button did nothing.",
				sessionId: allowed.id,
				speakerLabel: "Maya",
			},
		});
		if (quote.status !== "committed") {
			throw new Error("expected Kişisel veri attributed quote");
		}
	}
	if (notApplicable) {
		const note = await writeObservation(prisma, {
			actorId: input.actorId,
			baseRevision: notApplicable.revision,
			idempotencyKey: "kisisel-veri-na-note",
			origin: "human",
			payload: {
				body: "Storefront on Oak Street.",
				sessionId: notApplicable.id,
			},
		});
		if (note.status !== "committed") {
			throw new Error("expected Kişisel veri observation");
		}
	}
	const refreshed = await Promise.all(
		input.sessions.map((session) => getResearchSession(prisma, session.id))
	);
	return refreshed.map((session) => {
		if (!session) {
			throw new Error("expected Kişisel veri fixture session");
		}
		return session;
	});
}

const KISISEL_PURPOSE = "Kişisel veri research consent";

async function writeCreate(
	prisma: PrismaClient,
	command: CreateResearchSessionCommand
): Promise<ResearchSessionWriteOutcome> {
	const consent = command.payload.consent ?? CONSENT.notAsked;
	const fingerprint = payloadFingerprint({ ...command.payload, consent });
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, command, commandKey, fingerprint, consent)
	);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateResearchSessionCommand,
	commandKey: string,
	fingerprint: string,
	consent: ConsentValue
): Promise<ResearchSessionWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const recordedAt = new Date();
	const created = await tx.researchSession.create({
		data: {
			channel: command.payload.channel,
			consent,
			consentNote: command.payload.consentNote ?? "",
			consentRecordedAt: recordedAt,
			consentRecordedByUserId: command.actorId,
			contactId: command.payload.contactId ?? null,
			durationMinutes: command.payload.durationMinutes ?? null,
			facilitator: command.payload.facilitator,
			id: crypto.randomUUID(),
			projectId: command.payload.projectId,
			purpose: command.payload.purpose,
			questionGuide: command.payload.questionGuide,
			revision: 1,
			scheduledAt: command.payload.scheduledAt
				? new Date(command.payload.scheduledAt)
				: null,
			scopeNote: command.payload.scopeNote,
			status: command.payload.status ?? RESEARCH_SESSION_STATUS.planned,
			title: command.payload.title,
		},
	});
	await tx.researchSessionEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: RESEARCH_SESSION_EVENT_KIND.create,
			next: consent,
			previous: null,
			sessionId: created.id,
		},
	});
	const view = toView(created, [], []);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { session: view, status: "committed" };
}

async function setConsentInTransaction(
	tx: PrismaTransaction,
	command: {
		actorId: string;
		baseRevision: number;
		payload: { consent: ConsentValue; consentNote?: string; sessionId: string };
	},
	commandKey: string,
	fingerprint: string
): Promise<ResearchSessionWriteOutcome> {
	return await updateSessionField(tx, {
		actorId: command.actorId,
		baseRevision: command.baseRevision,
		commandKey,
		eventKind: RESEARCH_SESSION_EVENT_KIND.setConsent,
		fingerprint,
		next: command.payload.consent,
		patch: {
			consent: command.payload.consent,
			consentNote: command.payload.consentNote ?? "",
			consentRecordedAt: new Date(),
			consentRecordedByUserId: command.actorId,
		},
		sessionId: command.payload.sessionId,
	});
}

async function writeNote(
	prisma: PrismaClient,
	command: unknown,
	forcedKind?: NoteKind
): Promise<ResearchSessionWriteOutcome> {
	const parsed = writeNoteCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const kind = forcedKind ?? parsed.data.payload.kind;
	if (!kind) {
		return { reason: "untyped-note-refused", status: "rejected" };
	}
	const speakerLabel =
		kind === NOTE_KIND.participantQuote
			? (parsed.data.payload.speakerLabel ?? null)
			: null;
	if (kind !== NOTE_KIND.participantQuote && parsed.data.payload.speakerLabel) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const payload = {
		...parsed.data.payload,
		kind,
		speakerLabel,
	};
	const fingerprint = payloadFingerprint(payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const current = await tx.researchSession.findUnique({
			where: { id: payload.sessionId },
		});
		if (!current) {
			return { reason: "session-not-found", status: "rejected" };
		}
		await lockProject(tx, current.projectId);
		const replayed = await replayOrConflict(tx, commandKey, fingerprint);
		if (replayed) {
			return replayed;
		}
		const locked = await tx.researchSession.findUnique({
			where: { id: current.id },
		});
		if (!locked) {
			return { reason: "session-not-found", status: "rejected" };
		}
		if (locked.revision !== parsed.data.baseRevision) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const consent = presentConsent(locked.consent);
		if (!consentGatesOpen(consent)) {
			return { reason: "consent-gates-closed", status: "rejected" };
		}
		await tx.researchSessionNote.create({
			data: {
				body: payload.body,
				capturedUnderConsent: consent,
				id: crypto.randomUUID(),
				kind,
				sessionId: locked.id,
				speakerLabel,
			},
		});
		await tx.researchSessionEvent.create({
			data: {
				actorId: parsed.data.actorId,
				id: crypto.randomUUID(),
				kind: RESEARCH_SESSION_EVENT_KIND.writeNote,
				next: kind,
				previous: null,
				sessionId: locked.id,
			},
		});
		const updated = await tx.researchSession.update({
			data: { revision: locked.revision + 1 },
			where: { id: locked.id },
		});
		const view = await hydrateOne(tx, updated);
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { session: view, status: "committed" };
	});
}

async function attachFileInTransaction(
	tx: PrismaTransaction,
	command: {
		actorId: string;
		baseRevision: number;
		payload: { fileAttachmentId: string; sessionId: string };
	},
	commandKey: string,
	fingerprint: string
): Promise<ResearchSessionWriteOutcome> {
	const current = await tx.researchSession.findUnique({
		where: { id: command.payload.sessionId },
	});
	if (!current) {
		return { reason: "session-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.researchSession.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "session-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const consent = presentConsent(locked.consent);
	if (!consentGatesOpen(consent)) {
		return { reason: "consent-gates-closed", status: "rejected" };
	}
	await tx.researchSessionFile.create({
		data: {
			capturedUnderConsent: consent,
			fileAttachmentId: command.payload.fileAttachmentId,
			id: crypto.randomUUID(),
			sessionId: locked.id,
		},
	});
	await tx.researchSessionEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: RESEARCH_SESSION_EVENT_KIND.attachFile,
			next: command.payload.fileAttachmentId,
			previous: null,
			sessionId: locked.id,
		},
	});
	const updated = await tx.researchSession.update({
		data: { revision: locked.revision + 1 },
		where: { id: locked.id },
	});
	const view = await hydrateOne(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { session: view, status: "committed" };
}

async function updateSessionField(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		baseRevision: number;
		commandKey: string;
		eventKind: string;
		fingerprint: string;
		next: string | null;
		patch: Prisma.ResearchSessionUpdateInput;
		sessionId: string;
	}
): Promise<ResearchSessionWriteOutcome> {
	const current = await tx.researchSession.findUnique({
		where: { id: input.sessionId },
	});
	if (!current) {
		return { reason: "session-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(
		tx,
		input.commandKey,
		input.fingerprint
	);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.researchSession.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "session-not-found", status: "rejected" };
	}
	if (locked.revision !== input.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const updated = await tx.researchSession.update({
		data: {
			...input.patch,
			revision: locked.revision + 1,
		},
		where: { id: locked.id },
	});
	await tx.researchSessionEvent.create({
		data: {
			actorId: input.actorId,
			id: crypto.randomUUID(),
			kind: input.eventKind,
			next: input.next ?? "",
			previous: locked.consent,
			sessionId: locked.id,
		},
	});
	const view = await hydrateOne(tx, updated);
	await writeReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		view,
	});
	return { session: view, status: "committed" };
}

function closedWorldItems(view: ResearchSessionView): ClosedWorldItem[] {
	const items: ClosedWorldItem[] = [
		{
			id: view.id,
			kind: CLOSED_WORLD_ITEM_KIND.researchSession,
			title: view.title,
		},
		{
			consent: view.consent,
			id: `consent:${view.id}:${view.consent}`,
			kind: CLOSED_WORLD_ITEM_KIND.consent,
		},
	];
	if (!view.consentGatesOpen) {
		return items;
	}
	if (view.contactId) {
		items.push({
			contactId: view.contactId,
			id: `contact:${view.contactId}`,
			kind: CLOSED_WORLD_ITEM_KIND.contact,
		});
	}
	for (const note of view.notes) {
		if (!consentGatesOpen(note.capturedUnderConsent)) {
			continue;
		}
		if (note.kind === NOTE_KIND.participantQuote) {
			items.push({
				body: note.body,
				id: note.id,
				kind: CLOSED_WORLD_ITEM_KIND.participantQuote,
				speakerLabel: note.speakerLabel,
			});
		}
		if (note.kind === NOTE_KIND.observation) {
			items.push({
				body: note.body,
				id: note.id,
				kind: CLOSED_WORLD_ITEM_KIND.observation,
			});
		}
		if (note.kind === NOTE_KIND.founderInterpretation) {
			items.push({
				body: note.body,
				id: note.id,
				kind: CLOSED_WORLD_ITEM_KIND.founderInterpretation,
			});
		}
	}
	for (const file of view.files) {
		if (!consentGatesOpen(file.capturedUnderConsent)) {
			continue;
		}
		items.push({
			fileAttachmentId: file.fileAttachmentId,
			id: file.id,
			kind: CLOSED_WORLD_ITEM_KIND.fileAttachment,
		});
	}
	return items;
}

function presentConsent(stored: string): ConsentValue {
	if (stored === CONSENT.allowed) {
		return CONSENT.allowed;
	}
	if (stored === CONSENT.notAllowed) {
		return CONSENT.notAllowed;
	}
	if (stored === CONSENT.notApplicable) {
		return CONSENT.notApplicable;
	}
	return CONSENT.notAsked;
}

function presentNoteKind(stored: string): NoteKind {
	if (stored === NOTE_KIND.participantQuote) {
		return NOTE_KIND.participantQuote;
	}
	if (stored === NOTE_KIND.founderInterpretation) {
		return NOTE_KIND.founderInterpretation;
	}
	return NOTE_KIND.observation;
}

function presentStatus(stored: string): ResearchSessionStatus {
	if (stored === RESEARCH_SESSION_STATUS.completed) {
		return RESEARCH_SESSION_STATUS.completed;
	}
	if (stored === RESEARCH_SESSION_STATUS.cancelled) {
		return RESEARCH_SESSION_STATUS.cancelled;
	}
	return RESEARCH_SESSION_STATUS.planned;
}

function toView(
	row: SessionRow,
	notes: readonly NoteRow[],
	files: readonly FileRow[]
): ResearchSessionView {
	const consent = presentConsent(row.consent);
	return {
		channel: row.channel,
		consent,
		consentGatesOpen: consentGatesOpen(consent),
		consentIsNotLegalJudgment: RESEARCH_SESSIONS_COPY.consentIsNotLegalJudgment,
		consentNote: row.consentNote,
		consentRecordedAt: row.consentRecordedAt.toISOString(),
		consentRecordedByUserId: row.consentRecordedByUserId,
		contactId: row.contactId,
		durationMinutes: row.durationMinutes,
		facilitator: row.facilitator,
		files: files.map((file) => ({
			capturedUnderConsent: presentConsent(file.capturedUnderConsent),
			fileAttachmentId: file.fileAttachmentId,
			id: file.id,
		})),
		id: row.id,
		notes: notes.map((note) => ({
			body: note.body,
			capturedUnderConsent: presentConsent(note.capturedUnderConsent),
			id: note.id,
			kind: presentNoteKind(note.kind),
			speakerLabel:
				presentNoteKind(note.kind) === NOTE_KIND.participantQuote
					? note.speakerLabel
					: null,
		})),
		projectId: row.projectId,
		purpose: row.purpose,
		questionGuide: row.questionGuide,
		recordKind: RESEARCH_SESSIONS_COPY.researchSession,
		revision: row.revision,
		scheduledAt: row.scheduledAt?.toISOString() ?? null,
		scopeNote: row.scopeNote,
		status: presentStatus(row.status),
		title: row.title,
		youRemainResponsible: RESEARCH_SESSIONS_COPY.youRemainResponsible,
	};
}

async function hydrateOne(
	db: PrismaClient | PrismaTransaction,
	row: SessionRow
): Promise<ResearchSessionView> {
	const [views] = await hydrateViews(db, [row]);
	if (!views) {
		return toView(row, [], []);
	}
	return views;
}

async function hydrateViews(
	db: PrismaClient | PrismaTransaction,
	rows: SessionRow[]
): Promise<ResearchSessionView[]> {
	if (rows.length === 0) {
		return [];
	}
	const ids = rows.map((row) => row.id);
	const [notes, files] = await Promise.all([
		db.researchSessionNote.findMany({
			orderBy: { createdAt: "asc" },
			where: { sessionId: { in: ids } },
		}),
		db.researchSessionFile.findMany({
			orderBy: { createdAt: "asc" },
			where: { sessionId: { in: ids } },
		}),
	]);
	const notesBySession = new Map<string, NoteRow[]>();
	for (const note of notes) {
		const list = notesBySession.get(note.sessionId) ?? [];
		list.push(note);
		notesBySession.set(note.sessionId, list);
	}
	const filesBySession = new Map<string, FileRow[]>();
	for (const file of files) {
		const list = filesBySession.get(file.sessionId) ?? [];
		list.push(file);
		filesBySession.set(file.sessionId, list);
	}
	return rows.map((row) =>
		toView(
			row,
			notesBySession.get(row.id) ?? [],
			filesBySession.get(row.id) ?? []
		)
	);
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ResearchSessionWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.researchSession.findUnique({
		where: { id: existing.targetId },
	});
	if (!live) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { session: await hydrateOne(tx, live), status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: ResearchSessionView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.view.id,
		},
	});
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`research-sessions:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
