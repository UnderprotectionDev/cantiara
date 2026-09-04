/**
 * Contact and Company seam — Workspace identity book:
 * optional display name and email aliases, optional Company
 * via Belongs to Company with affiliation history, Persona as
 * Document relation only, no CRM fields, no personal-data erase,
 * profile hub via Open Source Record, duplicate candidates
 * without auto-merge.
 * docs/specs/46-contact-and-company/spec.md and GitHub #330 / #331.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı identity context; Hesap ve kişisel veri identity book).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDocument } from "../../documents/server/documents";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

import {
	createCompany,
	createContact,
	getContact,
	listCompanies,
	listContacts,
	listDuplicateCandidates,
	relateContactPersona,
	setContactCompany,
} from "./contact-and-company";
import { CONTACT_AND_COMPANY_COPY } from "./contact-and-company-model";

const DATABASE_URL = localTestDatabaseUrl();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;
const CRM_COPY =
	/ARR|MRR|subscription|sales stage|geo segment|commercial value|contract|revenue|plan tier/i;
const ERASE_COPY =
	/Erase personal data|Export personal data|Confirm GitHub Identity/i;
const FEED_COPY = /Evidence Flow|Feedback Capture|Feedback feed/i;
const COMPANY_MERGE_COPY = /Merge Companies|mergeCompanies/;

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
	await prisma.typedRelation.deleteMany();
	await prisma.contactCompanyAffiliation.deleteMany();
	await prisma.contactEmailAlias.deleteMany();
	await prisma.contact.deleteMany();
	await prisma.company.deleteMany();
	await prisma.document.deleteMany();
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
	const pool = new Pool({ connectionString: DATABASE_URL });
	const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

	beforeAll(async () => {
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
});
