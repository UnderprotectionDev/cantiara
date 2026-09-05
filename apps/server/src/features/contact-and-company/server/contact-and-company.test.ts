/**
 * Contact and Company seam — Workspace identity book:
 * optional display name and email aliases, optional Company
 * via Belongs to Company with affiliation history, Persona as
 * Document relation only, no CRM fields, no personal-data erase,
 * profile hub via Open Source Record, duplicate candidates
 * without auto-merge, merge preview, atomic consolidation,
 * retired-id redirect that is not a search hit, merge undo,
 * later unrelated edits not rewound, unrestorable undo preview,
 * and merge counterparts for Kanıt Rolü, Kanıt niteliği, and İş priority.
 * docs/specs/46-contact-and-company/spec.md and GitHub #330 / #331 / #332 / #333.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı identity context; Hesap ve kişisel veri identity book).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDocument } from "../../documents/server/documents";
import {
	bindEvidence,
	getEvidencePin,
	previewBindEvidence,
	setEvidenceFounderInterpretation,
	setEvidenceRole,
} from "../../evidence/server/evidence";
import { EVIDENCE_COPY } from "../../evidence/server/evidence-model";
import { createFeedback } from "../../feedback/server/feedback";
import {
	createPriorityCriterion,
	listWorkPriorityValues,
	setPriorityCriterionValue,
} from "../../priority/server/priority";
import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createSource } from "../../sources-and-freshness/server/sources";
import {
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";

import {
	createCompany,
	createContact,
	getContact,
	listCompanies,
	listContactMergeAudit,
	listContacts,
	listDuplicateCandidates,
	mergeContacts,
	previewContactMerge,
	previewContactMergeUndo,
	relateContactPersona,
	searchContacts,
	setContactCompany,
	undoMergeContacts,
} from "./contact-and-company";
import {
	CONTACT_AND_COMPANY_COPY,
	CONTACT_MERGE_EVENT_TYPE,
	CONTACT_MERGE_UNDO_EVENT_TYPE,
} from "./contact-and-company-model";

const DATABASE_URL = localTestDatabaseUrl();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;
const CRM_COPY =
	/ARR|MRR|subscription|sales stage|geo segment|commercial value|contract|revenue|plan tier/i;
const ERASE_COPY =
	/Erase personal data|Export personal data|Confirm GitHub Identity/i;
const FEED_COPY = /Evidence Flow|Feedback Capture|Feedback feed/i;
const COMPANY_MERGE_COPY = /Merge Companies|mergeCompanies/;
const FULL_RESTORE_COPY = /fully (un)?did|full restore|Undo complete/i;
const LIVE_MERGED_STATUS = /\bMerged\b/;
const RAW_MAYA_EMAIL = /maya/i;
const RAW_MAYA_ALIAS = /maya\.chen@example\.com/i;
const PRIORITY_ON_WORK = /priority-criterion|High/;

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
	await prisma.evidenceRelationHistory.deleteMany();
	await prisma.evidencePin.deleteMany();
	await prisma.contactMergeEvent.deleteMany();
	await prisma.projectPriorityCriterionValue.deleteMany();
	await prisma.projectPriorityCriterion.deleteMany();
	await prisma.feedback.deleteMany();
	await prisma.source.deleteMany();
	await prisma.typedRelation.deleteMany();
	await prisma.contactCompanyAffiliation.deleteMany();
	await prisma.contactEmailAlias.deleteMany();
	await prisma.contact.deleteMany();
	await prisma.company.deleteMany();
	await prisma.document.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.project.deleteMany();
	await prisma.auditEvent.deleteMany();
	await prisma.accountPreference.deleteMany();
	await prisma.workspace.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function committedContact(
	prisma: PrismaClient,
	input: {
		actorId: string;
		companyId?: string;
		displayName?: string;
		email?: string;
		workspaceId: string;
	}
) {
	const created = await createContact(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			companyId: input.companyId,
			displayName: input.displayName,
			email: input.email,
		},
		workspaceId: input.workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Contact");
	}
	return created.contact;
}

async function committedCompany(
	prisma: PrismaClient,
	input: { actorId: string; name: string; workspaceId: string }
) {
	const created = await createCompany(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: { name: input.name },
		workspaceId: input.workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Company");
	}
	return created.company;
}

describe("Contact and Company", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.$connect();
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("creates a Workspace Contact whose identity is not email and whose name and email are optional", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const unnamed = await committedContact(prisma, { actorId, workspaceId });
		expect(unnamed.displayName).toBeNull();
		expect(unnamed.emailAliases).toEqual([]);
		expect(unnamed.id).toMatch(UUID);
		expect(unnamed.currentCompany).toBeNull();
		expect(unnamed.copy.contact).toBe("Contact");
		const named = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: " Maya.Chen@Example.com ",
			workspaceId,
		});
		expect(named.displayName).toBe("Maya Chen");
		expect(named.emailAliases).toEqual([
			{
				normalizedEmail: "maya.chen@example.com",
				originalEmail: "Maya.Chen@Example.com",
			},
		]);
		expect(named.id).not.toBe("maya.chen@example.com");
		expect(named.id).not.toBe(unnamed.id);
		const loaded = await getContact(prisma, named.id, workspaceId);
		expect(loaded?.id).toBe(named.id);
		expect(loaded?.emailAliases[0]?.normalizedEmail).toBe(
			"maya.chen@example.com"
		);
	});

	it("keeps Company optional and at most one current Belongs to Company while preserving affiliation history", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Globex",
			workspaceId,
		});
		expect(acme.copy.company).toBe("Company");
		const contact = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			workspaceId,
		});
		expect(contact.currentCompany).toEqual({ id: acme.id, name: "Acme" });
		expect(contact.copy.belongsToCompany).toBe("Belongs to Company");
		const relations = await listRelations(prisma, {
			record: { id: contact.id, kind: "Contact" },
			viewerWorkspaceId: workspaceId,
		});
		expect(
			relations.filter((row) => row.type === RELATIONS_COPY.belongsToCompany)
		).toHaveLength(1);
		const switched = await setContactCompany(prisma, {
			actorId,
			baseRevision: contact.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { companyId: globex.id, contactId: contact.id },
			workspaceId,
		});
		if (switched.status !== "committed") {
			throw new Error("expected company switch");
		}
		expect(switched.contact.currentCompany).toEqual({
			id: globex.id,
			name: "Globex",
		});
		expect(switched.contact.companyHistory).toHaveLength(2);
		expect(switched.contact.companyHistory[0]?.companyId).toBe(acme.id);
		expect(switched.contact.companyHistory[0]?.endedAt).toMatch(ISO_INSTANT);
		expect(switched.contact.companyHistory[1]?.companyId).toBe(globex.id);
		expect(switched.contact.companyHistory[1]?.endedAt).toBeNull();
		const after = await listRelations(prisma, {
			record: { id: contact.id, kind: "Contact" },
			viewerWorkspaceId: workspaceId,
		});
		expect(
			after.filter((row) => row.type === RELATIONS_COPY.belongsToCompany)
		).toHaveLength(1);
		expect(
			after.find((row) => row.type === RELATIONS_COPY.belongsToCompany)?.to.id
		).toBe(globex.id);
	});

	it("does not auto-assign a Persona Document and only stores an explicit Document relation", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const persona = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				scope: { kind: "personal-wiki" },
				title: "Founder persona",
				type: "Persona",
			},
			workspaceId,
		});
		if (persona.status !== "committed") {
			throw new Error("expected Persona Document");
		}
		const contact = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			workspaceId,
		});
		expect(contact.relatedPersonaDocuments).toEqual([]);
		const related = await relateContactPersona(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				contactId: contact.id,
				documentId: persona.document.id,
			},
			workspaceId,
		});
		if (related.status !== "committed") {
			throw new Error("expected Persona relation");
		}
		expect(related.contact.relatedPersonaDocuments).toEqual([
			{
				id: persona.document.id,
				kind: "Document",
				openSourceRecord: CONTACT_AND_COMPANY_COPY.openSourceRecord,
				title: "Founder persona",
			},
		]);
		expect(related.contact.copy.openSourceRecord).toBe("Open Source Record");
	});

	it("omits CRM fields, Feedback feed, Kanıt Akışı, and personal-data erase from the identity book", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const contact = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			workspaceId,
		});
		const serialized = JSON.stringify({
			contact,
			copy: CONTACT_AND_COMPANY_COPY,
		});
		expect(serialized).not.toMatch(CRM_COPY);
		expect(serialized).not.toMatch(ERASE_COPY);
		expect(serialized).not.toMatch(FEED_COPY);
		expect(contact.relatedFeedback).toEqual([]);
		expect(contact).not.toHaveProperty("plan");
		expect(contact).not.toHaveProperty("arr");
		expect(contact).not.toHaveProperty("salesStage");
	});

	it("lists the same normalized email as a strong copy candidate without merging Contacts", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const first = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: " Maya.Chen@Example.com ",
			workspaceId,
		});
		const second = await committedContact(prisma, {
			actorId,
			displayName: "M. Chen",
			email: "maya.chen@example.com",
			workspaceId,
		});
		const candidates = await listDuplicateCandidates(prisma, workspaceId);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]?.strength).toBe("strong");
		expect(candidates[0]?.copy.strongCopyCandidate).toBe(
			"Strong copy candidate"
		);
		expect(candidates[0]?.reasons).toEqual(["same-normalized-email"]);
		expect(new Set([candidates[0]?.left.id, candidates[0]?.right.id])).toEqual(
			new Set([first.id, second.id])
		);
		expect(await getContact(prisma, first.id, workspaceId)).toMatchObject({
			displayName: "Maya Chen",
			id: first.id,
		});
		expect(await getContact(prisma, second.id, workspaceId)).toMatchObject({
			displayName: "M. Chen",
			id: second.id,
		});
		expect(await listContacts(prisma, workspaceId)).toHaveLength(2);
	});

	it("treats matching display name or current Company as a weak suggestion, not a strong candidate", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const namedA = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: "maya.a@example.com",
			workspaceId,
		});
		const namedB = await committedContact(prisma, {
			actorId,
			displayName: "  maya   chen ",
			email: "maya.b@example.com",
			workspaceId,
		});
		const companyA = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Alex Rivera",
			email: "alex.a@example.com",
			workspaceId,
		});
		const companyB = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Sam Lee",
			email: "sam.b@example.com",
			workspaceId,
		});
		const candidates = await listDuplicateCandidates(prisma, workspaceId);
		expect(candidates.every((row) => row.strength === "weak")).toBe(true);
		expect(
			candidates.every((row) => row.copy.weakSuggestion === "Weak suggestion")
		).toBe(true);
		expect(
			candidates.some((row) => row.reasons.includes("same-normalized-email"))
		).toBe(false);
		const namePair = candidates.find(
			(row) =>
				new Set([row.left.id, row.right.id]).has(namedA.id) &&
				new Set([row.left.id, row.right.id]).has(namedB.id)
		);
		expect(namePair?.reasons).toEqual(["similar-name"]);
		const companyPair = candidates.find(
			(row) =>
				new Set([row.left.id, row.right.id]).has(companyA.id) &&
				new Set([row.left.id, row.right.id]).has(companyB.id)
		);
		expect(companyPair?.reasons).toEqual(["similar-company"]);
		expect(await listContacts(prisma, workspaceId)).toHaveLength(4);
	});

	it("does not rewrite relation endpoints when listing candidates and has no auto-merge or Company merge", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const first = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const second = await committedContact(prisma, {
			actorId,
			companyId: globex.id,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const beforeRelations = await listRelations(prisma, {
			record: { id: first.id, kind: "Contact" },
			viewerWorkspaceId: workspaceId,
		});
		const beforeRevision = first.revision;
		await listDuplicateCandidates(prisma, workspaceId);
		const after = await getContact(prisma, first.id, workspaceId);
		expect(after?.id).toBe(first.id);
		expect(after?.revision).toBe(beforeRevision);
		expect(after?.currentCompany).toEqual({ id: acme.id, name: "Acme" });
		const afterRelations = await listRelations(prisma, {
			record: { id: first.id, kind: "Contact" },
			viewerWorkspaceId: workspaceId,
		});
		expect(afterRelations).toEqual(beforeRelations);
		expect(await getContact(prisma, second.id, workspaceId)).toMatchObject({
			currentCompany: { id: globex.id, name: "Acme" },
			id: second.id,
		});
		expect(await listCompanies(prisma, workspaceId)).toHaveLength(2);
		expect(
			JSON.stringify({
				candidates: await listDuplicateCandidates(prisma, workspaceId),
				copy: CONTACT_AND_COMPANY_COPY,
			})
		).not.toMatch(COMPANY_MERGE_COPY);
	});

	it("does not create a Contact when the identity book is listed with no people", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		expect(await listDuplicateCandidates(prisma, workspaceId)).toEqual([]);
		expect(await listContacts(prisma, workspaceId)).toEqual([]);
	});

	it("previews survivor, field conflicts, aliases, Feedback, Company, and Persona without writing", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Globex",
			workspaceId,
		});
		const persona = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				scope: { kind: "personal-wiki" },
				title: "Buyer persona",
				type: "Persona",
			},
			workspaceId,
		});
		if (persona.status !== "committed") {
			throw new Error("expected Persona Document");
		}
		const survivor = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			companyId: globex.id,
			displayName: "M. Chen",
			email: "maya.chen@example.com",
			workspaceId,
		});
		await relateContactPersona(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				contactId: duplicate.id,
				documentId: persona.document.id,
			},
			workspaceId,
		});
		const project = await createProject(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { name: "Payments", starterConfiguration: "Blank Project" },
			workspaceId,
		});
		if (project.status !== "committed" && project.status !== "replayed") {
			throw new Error("expected project");
		}
		const feedback = await createFeedback(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				channel: "Email",
				contactId: duplicate.id,
				originalMessage: "Checkout retries forever.",
				projectId: project.project.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		if (feedback.status !== "committed") {
			throw new Error("expected Feedback");
		}
		const beforeSurvivor = await getContact(prisma, survivor.id, workspaceId);
		const beforeDuplicate = await getContact(prisma, duplicate.id, workspaceId);
		const preview = await previewContactMerge(prisma, {
			duplicateId: duplicate.id,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(preview).toMatchObject({
			copy: {
				feedbackHistory: "Feedback history",
				fieldConflicts: "Field conflicts",
				mergeContacts: "Merge Contacts",
				mergePreview: "Merge Preview",
				survivingRecord: "Surviving record",
			},
			duplicate: { id: duplicate.id },
			emailAliases: expect.arrayContaining([
				expect.objectContaining({
					normalizedEmail: "maya@example.com",
				}),
				expect.objectContaining({
					normalizedEmail: "maya.chen@example.com",
				}),
			]),
			relatedFeedback: [
				expect.objectContaining({
					id: feedback.feedback.id,
					title: "Checkout retries forever.",
				}),
			],
			relatedPersonaDocuments: [
				expect.objectContaining({ id: persona.document.id }),
			],
			survivor: { id: survivor.id },
		});
		if ("reason" in preview) {
			throw new Error("expected preview");
		}
		expect(preview.fieldConflicts.map((row) => row.field).sort()).toEqual([
			"currentCompany",
			"displayName",
		]);
		expect(preview.relationsToRewrite.length).toBeGreaterThan(0);
		expect(
			preview.relationsToRewrite.some(
				(row) => row.toId === duplicate.id && row.rewrittenToId === survivor.id
			)
		).toBe(true);
		expect(await getContact(prisma, survivor.id, workspaceId)).toEqual(
			beforeSurvivor
		);
		expect(await getContact(prisma, duplicate.id, workspaceId)).toEqual(
			beforeDuplicate
		);
		expect(JSON.stringify(preview)).not.toMatch(COMPANY_MERGE_COPY);
	});

	it("refuses Merge Contacts without a preview and leaves both Contacts live", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const survivor = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			displayName: "M. Chen",
			email: "maya@example.com",
			workspaceId,
		});
		expect(
			await mergeContacts(prisma, {
				actorId,
				duplicateBaseRevision: duplicate.revision,
				duplicateId: duplicate.id,
				idempotencyKey: "silent-merge",
				origin: "human",
				survivorBaseRevision: survivor.revision,
				survivorId: survivor.id,
				workspaceId,
			})
		).toEqual({
			reason: "merge-preview-required",
			status: "rejected",
		});
		expect(await listContacts(prisma, workspaceId)).toHaveLength(2);
	});

	it("consolidates onto one surviving Contact, redirects the retired id, and keeps Feedback", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Globex",
			workspaceId,
		});
		const persona = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				scope: { kind: "personal-wiki" },
				title: "Buyer persona",
				type: "Persona",
			},
			workspaceId,
		});
		if (persona.status !== "committed") {
			throw new Error("expected Persona Document");
		}
		const survivor = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			companyId: globex.id,
			displayName: "M. Chen",
			email: "maya.chen@example.com",
			workspaceId,
		});
		await relateContactPersona(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				contactId: duplicate.id,
				documentId: persona.document.id,
			},
			workspaceId,
		});
		const project = await createProject(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { name: "Payments", starterConfiguration: "Blank Project" },
			workspaceId,
		});
		if (project.status !== "committed" && project.status !== "replayed") {
			throw new Error("expected project");
		}
		const feedback = await createFeedback(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				channel: "Email",
				contactId: duplicate.id,
				originalMessage: "Checkout retries forever.",
				projectId: project.project.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		if (feedback.status !== "committed") {
			throw new Error("expected Feedback");
		}
		const merged = await mergeContacts(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { currentCompany: "survivor", displayName: "survivor" },
			idempotencyKey: "merge-maya",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(merged).toMatchObject({
			contact: {
				currentCompany: { id: acme.id, name: "Acme" },
				displayName: "Maya Chen",
				id: survivor.id,
				retiredIdentities: [{ id: duplicate.id }],
			},
			status: "committed",
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		expect(
			merged.contact.emailAliases.map((row) => row.normalizedEmail).sort()
		).toEqual(["maya.chen@example.com", "maya@example.com"]);
		expect(merged.contact.relatedFeedback.map((row) => row.id)).toEqual([
			feedback.feedback.id,
		]);
		expect(merged.contact.relatedPersonaDocuments.map((row) => row.id)).toEqual(
			[persona.document.id]
		);
		expect(JSON.stringify(merged)).not.toMatch(LIVE_MERGED_STATUS);
		expect(JSON.stringify(merged.audit)).not.toMatch(RAW_MAYA_EMAIL);
		expect(merged.audit.type).toBe(CONTACT_MERGE_EVENT_TYPE);
		expect(merged.audit.actorAlias).not.toBe(actorId);
		expect(merged.audit.retiredAlias).not.toBe(duplicate.id);
		const listed = await listContacts(prisma, workspaceId);
		expect(listed.map((row) => row.id)).toEqual([survivor.id]);
		expect(JSON.stringify(listed)).not.toMatch(LIVE_MERGED_STATUS);
		expect(await getContact(prisma, duplicate.id, workspaceId)).toMatchObject({
			id: survivor.id,
			origin: { id: duplicate.id },
		});
		expect(await searchContacts(prisma, workspaceId, duplicate.id)).toEqual([]);
		expect(
			(await searchContacts(prisma, workspaceId, "Maya Chen")).map(
				(row) => row.id
			)
		).toEqual([survivor.id]);
		const audits = await listContactMergeAudit(prisma);
		expect(audits).toEqual([
			expect.objectContaining({
				actorAlias: merged.audit.actorAlias,
				retiredAlias: merged.audit.retiredAlias,
				type: CONTACT_MERGE_EVENT_TYPE,
			}),
		]);
		expect(JSON.stringify(audits)).not.toMatch(RAW_MAYA_ALIAS);
		expect(await listDuplicateCandidates(prisma, workspaceId)).toEqual([]);
	});

	it("does not rewrite Kanıt Rolü, Founder interpretation, Kanıt niteliği, or İş priority on merge", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const survivor = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const project = await createProject(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { name: "Payments", starterConfiguration: "Blank Project" },
			workspaceId,
		});
		if (project.status !== "committed" && project.status !== "replayed") {
			throw new Error("expected project");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.project.id, title: "Checkout" },
		});
		if (work.status !== "committed") {
			throw new Error("expected Work");
		}
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { name: "Urgency", projectId: project.project.id },
		});
		if (criterion.status !== "committed") {
			throw new Error("expected criterion");
		}
		const priority = await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "High",
				workId: work.work.id,
			},
		});
		expect(priority.status).toBe("committed");
		const source = await createSource(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				capturedContent: "Checkout Session creates a payment page.",
				projectId: project.project.id,
				title: "Stripe Checkout",
				url: "https://docs.stripe.com/payments/checkout",
			},
		});
		if (source.status !== "committed") {
			throw new Error("expected Source");
		}
		const versionId = source.source.versions[0]?.id ?? "";
		const previewed = await previewBindEvidence(prisma, {
			selectedText: "Checkout Session",
			sourceId: source.source.id,
			sourceKind: "Source",
			sourceVersionId: versionId,
			targetId: work.work.id,
			targetKind: "Work",
			workspaceId,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected evidence preview");
		}
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Checkout Session",
				sourceId: source.source.id,
				sourceKind: "Source",
				sourceVersionId: versionId,
				targetId: work.work.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		const role = await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				pinId: bound.pin.id,
				role: EVIDENCE_COPY.supporting,
			},
			workspaceId,
		});
		expect(role.status).toBe("committed");
		const interpretation = await setEvidenceFounderInterpretation(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				founderInterpretation: "This supports the claim.",
				pinId: bound.pin.id,
			},
			workspaceId,
		});
		expect(interpretation.status).toBe("committed");
		const merged = await mergeContacts(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			idempotencyKey: "merge-without-meaning",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(merged.status).toBe("committed");
		const pin = await getEvidencePin(prisma, bound.pin.id);
		expect(pin?.role).toBe(EVIDENCE_COPY.supporting);
		expect(pin?.founderInterpretation).toBe("This supports the claim.");
		expect(pin).not.toHaveProperty("evidenceQuality");
		expect(pin).not.toHaveProperty("reportedProblem");
		expect(pin).not.toHaveProperty("impactSeverity");
		const stillWork = await getWork(prisma, work.work.id);
		expect(stillWork?.status).toBe("Not Started");
		expect(JSON.stringify(stillWork)).not.toMatch(PRIORITY_ON_WORK);
		const values = await listWorkPriorityValues(
			prisma,
			project.project.id,
			work.work.id
		);
		expect(values).toEqual([
			expect.objectContaining({
				rank: "High",
				workId: work.work.id,
			}),
		]);
	});

	it("undoes merge by restoring the retired Contact and splitting only merge-attributed aliases and relations", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Globex",
			workspaceId,
		});
		const persona = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				scope: { kind: "personal-wiki" },
				title: "Buyer persona",
				type: "Persona",
			},
			workspaceId,
		});
		if (persona.status !== "committed") {
			throw new Error("expected Persona Document");
		}
		const survivor = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			companyId: globex.id,
			displayName: "M. Chen",
			email: "maya.chen@example.com",
			workspaceId,
		});
		await relateContactPersona(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				contactId: duplicate.id,
				documentId: persona.document.id,
			},
			workspaceId,
		});
		const merged = await mergeContacts(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { currentCompany: "survivor", displayName: "survivor" },
			idempotencyKey: "merge-for-undo",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		const preview = await previewContactMergeUndo(prisma, {
			mergeEventId: merged.mergeEventId,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(preview).toMatchObject({
			copy: {
				undo: "Undo",
				undoPreview: "Undo Preview",
			},
			retiredContact: { id: duplicate.id },
			unrestorable: [],
		});
		if ("reason" in preview) {
			throw new Error("expected undo preview");
		}
		expect(JSON.stringify(preview)).not.toMatch(FULL_RESTORE_COPY);
		expect(JSON.stringify(preview)).not.toMatch(ERASE_COPY);
		const undone = await undoMergeContacts(prisma, {
			actorId,
			idempotencyKey: "undo-merge",
			mergeEventId: merged.mergeEventId,
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: merged.contact.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(undone).toMatchObject({
			restoredContactId: duplicate.id,
			status: "committed",
		});
		if (undone.status !== "committed") {
			throw new Error("expected committed undo");
		}
		expect(undone.audit.type).toBe(CONTACT_MERGE_UNDO_EVENT_TYPE);
		expect(JSON.stringify(undone.audit)).not.toMatch(RAW_MAYA_ALIAS);
		expect(await listContacts(prisma, workspaceId)).toHaveLength(2);
		expect(await getContact(prisma, duplicate.id, workspaceId)).toMatchObject({
			currentCompany: { id: globex.id },
			displayName: "M. Chen",
			id: duplicate.id,
			origin: null,
			relatedPersonaDocuments: [{ id: persona.document.id }],
		});
		const restored = await getContact(prisma, duplicate.id, workspaceId);
		expect(restored?.emailAliases.map((row) => row.normalizedEmail)).toEqual([
			"maya.chen@example.com",
		]);
		expect(await getContact(prisma, survivor.id, workspaceId)).toMatchObject({
			currentCompany: { id: acme.id },
			displayName: "Maya Chen",
			id: survivor.id,
			latestMergeEventId: null,
			retiredIdentities: [],
		});
		expect(
			(await getContact(prisma, survivor.id, workspaceId))?.emailAliases.map(
				(row) => row.normalizedEmail
			)
		).toEqual(["maya@example.com"]);
	});

	it("does not rewind a later unrelated Company write when undoing merge", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Globex",
			workspaceId,
		});
		const initech = await committedCompany(prisma, {
			actorId,
			name: "Initech",
			workspaceId,
		});
		const survivor = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			companyId: globex.id,
			displayName: "M. Chen",
			email: "maya.chen@example.com",
			workspaceId,
		});
		const merged = await mergeContacts(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { currentCompany: "survivor", displayName: "survivor" },
			idempotencyKey: "merge-then-company",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		const later = await setContactCompany(prisma, {
			actorId,
			baseRevision: merged.contact.revision,
			idempotencyKey: "later-company",
			origin: "human",
			payload: { companyId: initech.id, contactId: survivor.id },
			workspaceId,
		});
		if (later.status !== "committed") {
			throw new Error("expected later Company");
		}
		const undone = await undoMergeContacts(prisma, {
			actorId,
			idempotencyKey: "undo-keep-later",
			mergeEventId: merged.mergeEventId,
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: later.contact.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(undone.status).toBe("committed");
		expect(await getContact(prisma, survivor.id, workspaceId)).toMatchObject({
			currentCompany: { id: initech.id, name: "Initech" },
			displayName: "Maya Chen",
			id: survivor.id,
		});
		expect(await getContact(prisma, duplicate.id, workspaceId)).toMatchObject({
			currentCompany: { id: globex.id },
			id: duplicate.id,
			origin: null,
		});
	});

	it("stops undo for a user decision when a later write touched a merge-attributed field", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const acme = await committedCompany(prisma, {
			actorId,
			name: "Acme",
			workspaceId,
		});
		const globex = await committedCompany(prisma, {
			actorId,
			name: "Globex",
			workspaceId,
		});
		const initech = await committedCompany(prisma, {
			actorId,
			name: "Initech",
			workspaceId,
		});
		const survivor = await committedContact(prisma, {
			actorId,
			companyId: acme.id,
			displayName: "Maya Chen",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			companyId: globex.id,
			displayName: "M. Chen",
			workspaceId,
		});
		const merged = await mergeContacts(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { currentCompany: "duplicate", displayName: "survivor" },
			idempotencyKey: "merge-attributed-company",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		const later = await setContactCompany(prisma, {
			actorId,
			baseRevision: merged.contact.revision,
			idempotencyKey: "later-attributed-company",
			origin: "human",
			payload: { companyId: initech.id, contactId: survivor.id },
			workspaceId,
		});
		if (later.status !== "committed") {
			throw new Error("expected later attributed Company");
		}
		expect(
			await undoMergeContacts(prisma, {
				actorId,
				idempotencyKey: "undo-attributed",
				mergeEventId: merged.mergeEventId,
				origin: "human",
				previewAcknowledged: true,
				survivorBaseRevision: later.contact.revision,
				survivorId: survivor.id,
				workspaceId,
			})
		).toMatchObject({
			conflict: "Conflict",
			current: { currentCompany: { id: initech.id } },
			currentValueLabel: "Current value",
			status: "conflict",
		});
		expect(await getContact(prisma, duplicate.id, workspaceId)).toMatchObject({
			id: survivor.id,
			origin: { id: duplicate.id },
		});
	});

	it("shows unrestorable redacted or permanently deleted content in Undo Preview", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const persona = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				scope: { kind: "personal-wiki" },
				title: "Buyer persona",
				type: "Persona",
			},
			workspaceId,
		});
		if (persona.status !== "committed") {
			throw new Error("expected Persona Document");
		}
		const survivor = await committedContact(prisma, {
			actorId,
			displayName: "Maya Chen",
			email: "maya@example.com",
			workspaceId,
		});
		const duplicate = await committedContact(prisma, {
			actorId,
			displayName: "M. Chen",
			email: "maya.chen@example.com",
			workspaceId,
		});
		await relateContactPersona(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				contactId: duplicate.id,
				documentId: persona.document.id,
			},
			workspaceId,
		});
		const merged = await mergeContacts(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { displayName: "survivor" },
			idempotencyKey: "merge-for-unrestorable",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		await prisma.document.delete({ where: { id: persona.document.id } });
		await prisma.contactEmailAlias.updateMany({
			data: { originalEmail: "" },
			where: { normalizedEmail: "maya.chen@example.com" },
		});
		const preview = await previewContactMergeUndo(prisma, {
			mergeEventId: merged.mergeEventId,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(preview).toMatchObject({
			copy: { undoPreview: "Undo Preview" },
			unrestorable: expect.arrayContaining([
				expect.objectContaining({
					id: persona.document.id,
					reason: RELATIONS_COPY.permanentlyDeleted,
				}),
				expect.objectContaining({
					id: "maya.chen@example.com",
					reason: RELATIONS_COPY.redactedForSecurity,
				}),
			]),
		});
		if ("reason" in preview) {
			throw new Error("expected undo preview");
		}
		expect(JSON.stringify(preview)).not.toMatch(FULL_RESTORE_COPY);
		const undone = await undoMergeContacts(prisma, {
			actorId,
			idempotencyKey: "undo-partial",
			mergeEventId: merged.mergeEventId,
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: merged.contact.revision,
			survivorId: survivor.id,
			workspaceId,
		});
		expect(undone.status).toBe("committed");
		expect(await getContact(prisma, duplicate.id, workspaceId)).toMatchObject({
			id: duplicate.id,
			origin: null,
			relatedPersonaDocuments: [],
		});
		expect(JSON.stringify(undone)).not.toMatch(FULL_RESTORE_COPY);
		expect(JSON.stringify(CONTACT_AND_COMPANY_COPY)).not.toMatch(ERASE_COPY);
	});
});
