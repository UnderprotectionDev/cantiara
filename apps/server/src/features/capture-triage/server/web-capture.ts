import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@cantiara/db";

import {
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	CAPTURE_INBOX_COPY,
	type CaptureInboxItemView,
	toItemView,
} from "./capture-inbox-model";
import {
	type CaptureTargetInbox,
	clipFromExplicitAction,
	clipperBrowserFamilies,
	isClipperBrowserFamily,
	PAIRING_CODE_ALPHABET,
	PAIRING_CODE_LENGTH,
	PAIRING_CODE_TTL_MS,
	type ProjectCaptureTargetInbox,
	pageInjectionFor,
	previewWebCaptureView,
	sendPayloadFor,
	UNUSED_LINK_REAUTH_MS,
	type WebCaptureClip,
	type WebCaptureClipKind,
	type WebCapturePage,
	type WebCaptureTarget,
	webCaptureAttachmentRef,
	webCaptureBody,
	webCaptureContentFingerprint,
	wideReadWarning,
} from "./web-capture-model";

const STAGED = "staged";
const COMMITTED = "committed";
const CANCELLED = "cancelled";
const STAGE_KIND = "web-capture";

function hashSecret(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export async function findExtensionLinkByToken(
	prisma: PrismaClient,
	token: string
) {
	return await prisma.captureExtensionLink.findUnique({
		where: { tokenHash: hashSecret(token) },
	});
}

export async function pairExtensionWithCode(
	prisma: PrismaClient,
	clock: { now: () => Date },
	command: {
		browser: string;
		code: string;
		device: string;
		family: string;
	}
): Promise<PairExtensionOutcome> {
	const row = await prisma.capturePairingCode.findUnique({
		where: { codeHash: hashSecret(command.code) },
	});
	if (!row || row.consumedAt) {
		return { reason: "unpaired", status: "refused" };
	}
	return await createWebCapture({
		actorId: row.ownerId,
		clock,
		connected: () => true,
		logs: [],
		prisma,
		workspaceId: row.workspaceId,
	}).pair(command);
}

function generatePairingCode(): string {
	const bytes = randomBytes(PAIRING_CODE_LENGTH);
	let code = "";
	for (const byte of bytes) {
		code += PAIRING_CODE_ALPHABET[byte % PAIRING_CODE_ALPHABET.length];
	}
	return code;
}

function generateLinkToken(): string {
	return randomBytes(32).toString("base64url");
}

function reviveDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

export interface ExtensionLinkView {
	browser: string;
	device: string;
	id: string;
	lastUsedAt: Date;
}

export type IssuePairingCodeOutcome =
	| {
			code: string;
			expiresAt: Date;
			status: "issued";
	  }
	| { queued: false; reason: "offline"; status: "refused" };

export type PairExtensionOutcome =
	| {
			link: ExtensionLinkView;
			status: "paired";
			token: string;
	  }
	| {
			reason: "unpaired" | "unsupported-browser" | "offline";
			status: "refused";
	  };

export type SendWebCaptureOutcome =
	| {
			item: CaptureInboxItemView;
			lastSuccessfulSaveAt: Date;
			mainRecord: null;
			status: "saved";
	  }
	| { queued: false; reason: "offline"; status: "refused" }
	| {
			reason:
				| "unpaired"
				| "pairing-revoked"
				| "reauthorization-required"
				| "unsupported-browser";
			status: "refused";
	  }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

export type StageWebCaptureOutcome =
	| { stagingId: string; status: "staged" }
	| { queued: false; reason: "offline"; status: "refused" }
	| {
			reason:
				| "unpaired"
				| "pairing-revoked"
				| "reauthorization-required"
				| "unsupported-browser";
			status: "refused";
	  }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

export interface WebCapturePreview {
	content: {
		attachmentRef: string | null;
		body: string;
		kind: WebCaptureClipKind;
	};
	originUrl: string;
	target: WebCaptureTarget;
}

function reviveSavedOutcome(
	outcome: SendWebCaptureOutcome
): SendWebCaptureOutcome {
	if (outcome.status !== "saved") {
		return outcome;
	}
	return {
		...outcome,
		item: {
			...outcome.item,
			capturedAt: reviveDate(outcome.item.capturedAt),
		},
		lastSuccessfulSaveAt: reviveDate(outcome.lastSuccessfulSaveAt),
	};
}

async function readReceipt(
	prisma: PrismaClient,
	commandKey: string,
	payload: unknown
) {
	const existing = await prisma.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== payloadFingerprint(payload)) {
		return { kind: "conflict" as const };
	}
	return { kind: "replay" as const, resultValue: existing.resultValue };
}

async function writeReceipt(
	prisma: PrismaClient,
	input: {
		actorId: string;
		commandKey: string;
		payload: unknown;
		resultValue: string;
		targetId: string;
	}
) {
	await prisma.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			kind: STAGE_KIND,
			origin: "human",
			payloadFingerprint: payloadFingerprint(input.payload),
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
}

interface LinkRow {
	browser: string;
	device: string;
	family: string;
	id: string;
	lastUsedAt: Date;
	ownerId: string;
	revokedAt: Date | null;
	workspaceId: string;
}

function toLinkView(row: LinkRow): ExtensionLinkView {
	return {
		browser: row.browser,
		device: row.device,
		id: row.id,
		lastUsedAt: row.lastUsedAt,
	};
}

function stagedPayloadJson(
	command: {
		clip: WebCaptureClip;
		idempotencyKey: string;
		target: WebCaptureTarget;
	},
	linkId: string
): string {
	return JSON.stringify({
		clip: command.clip,
		idempotencyKey: command.idempotencyKey,
		linkId,
		target: command.target,
	});
}

function targetScopeFor(target: WebCaptureTarget): string {
	return target.kind === "project" ? target.projectId : "workspace";
}

async function reuseExistingStaging(
	prisma: PrismaClient,
	existingStaging: {
		id: string;
		payloadFingerprint: string;
		status: string;
	},
	command: {
		clip: WebCaptureClip;
		idempotencyKey: string;
		target: WebCaptureTarget;
	},
	fingerprint: string,
	linkId: string
): Promise<StageWebCaptureOutcome> {
	if (
		existingStaging.payloadFingerprint !== fingerprint &&
		existingStaging.payloadFingerprint !==
			webCaptureContentFingerprint(command.clip)
	) {
		return { reason: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (existingStaging.status === CANCELLED) {
		await prisma.mutationStagingOperation.update({
			data: {
				payloadFingerprint: fingerprint,
				payloadJson: stagedPayloadJson(command, linkId),
				status: STAGED,
				targetId: linkId,
				targetScope: targetScopeFor(command.target),
			},
			where: { id: existingStaging.id },
		});
	}
	return { stagingId: existingStaging.id, status: "staged" };
}

export function createWebCapture(input: {
	actorId: string;
	clock: { now: () => Date };
	connected: () => boolean;
	logs: string[];
	onSaved?: (savedAt: Date) => void;
	prisma: PrismaClient;
	workspaceId: string;
}) {
	async function findLinkByToken(token: string): Promise<LinkRow | null> {
		const row = await input.prisma.captureExtensionLink.findUnique({
			where: { tokenHash: hashSecret(token) },
		});
		if (
			!row ||
			row.ownerId !== input.actorId ||
			row.workspaceId !== input.workspaceId
		) {
			return null;
		}
		return row;
	}

	function linkWriteGate(
		row: LinkRow | null,
		now: Date
	):
		| { link: LinkRow; ok: true }
		| {
				ok: false;
				reason: "unpaired" | "pairing-revoked" | "reauthorization-required";
		  } {
		if (!row) {
			return { ok: false, reason: "unpaired" };
		}
		if (row.revokedAt) {
			return { ok: false, reason: "pairing-revoked" };
		}
		if (now.getTime() - row.lastUsedAt.getTime() > UNUSED_LINK_REAUTH_MS) {
			return { ok: false, reason: "reauthorization-required" };
		}
		return { link: row, ok: true };
	}

	function clipPayload(clip: WebCaptureClip, target: WebCaptureTarget) {
		return {
			attachmentRef: webCaptureAttachmentRef(clip) ?? "",
			body: webCaptureBody(clip),
			kind: clip.kind,
			originUrl: clip.originUrl,
			projectId: target.kind === "project" ? target.projectId : "",
			screenshot: clip.screenshot ?? "",
			selectedImage: clip.selectedImage ?? "",
			selectedText: clip.selectedText ?? "",
		};
	}

	async function commitClip(command: {
		clip: WebCaptureClip;
		idempotencyKey: string;
		link: LinkRow;
		target: WebCaptureTarget;
	}): Promise<SendWebCaptureOutcome> {
		const payload = clipPayload(command.clip, command.target);
		const existing = await readReceipt(
			input.prisma,
			command.idempotencyKey,
			payload
		);
		if (existing?.kind === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (existing?.kind === "replay") {
			return reviveSavedOutcome(
				JSON.parse(existing.resultValue) as SendWebCaptureOutcome
			);
		}
		const capturedAt = input.clock.now();
		const projectId =
			command.target.kind === "project" ? command.target.projectId : null;
		const row = await input.prisma.captureInboxItem.create({
			data: {
				attachmentRef: webCaptureAttachmentRef(command.clip),
				body: webCaptureBody(command.clip),
				capturedAt,
				fieldsText: "{}",
				id: crypto.randomUUID(),
				link: command.clip.originUrl,
				origin: command.clip.originUrl,
				ownerId: input.actorId,
				projectId,
				template: null,
				workspaceId: input.workspaceId,
			},
		});
		const item = toItemView(row);
		const outcome: SendWebCaptureOutcome = {
			item,
			lastSuccessfulSaveAt: capturedAt,
			mainRecord: null,
			status: "saved",
		};
		await writeReceipt(input.prisma, {
			actorId: input.actorId,
			commandKey: command.idempotencyKey,
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: item.id,
		});
		await input.prisma.captureExtensionLink.update({
			data: { lastUsedAt: capturedAt },
			where: { id: command.link.id },
		});
		input.onSaved?.(capturedAt);
		input.logs.push(`web-capture saved ${item.id}`);
		return outcome;
	}

	return {
		backgroundScan(): false {
			return false;
		},
		claimsSafariClipper(): false {
			return false;
		},
		clip(command: {
			kind: WebCaptureClipKind;
			page: WebCapturePage;
			wideReadGranted: boolean;
		}) {
			return clipFromExplicitAction(command);
		},
		clipArchive(): readonly never[] {
			return [];
		},
		clipperBrowserFamilies,
		contentFingerprint: webCaptureContentFingerprint,
		async finalizeWebCapture(command: {
			stagingId: string;
		}): Promise<SendWebCaptureOutcome> {
			if (!input.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const staging = await input.prisma.mutationStagingOperation.findUnique({
				where: { id: command.stagingId },
			});
			if (
				!staging ||
				staging.actorId !== input.actorId ||
				(staging.status !== STAGED && staging.status !== COMMITTED)
			) {
				return { reason: "unpaired", status: "refused" };
			}
			if (staging.status === COMMITTED) {
				const receipt = await input.prisma.mutationReceipt.findUnique({
					where: { commandKey: staging.commandKey },
				});
				if (!receipt) {
					return { reason: "unpaired", status: "refused" };
				}
				return reviveSavedOutcome(
					JSON.parse(receipt.resultValue) as SendWebCaptureOutcome
				);
			}
			const staged = JSON.parse(staging.payloadJson) as {
				clip: WebCaptureClip;
				idempotencyKey: string;
				linkId: string;
				target: WebCaptureTarget;
			};
			const link = await input.prisma.captureExtensionLink.findUnique({
				where: { id: staged.linkId },
			});
			const gate = linkWriteGate(link, input.clock.now());
			if (!gate.ok) {
				await input.prisma.mutationStagingOperation.update({
					data: { status: CANCELLED },
					where: { id: staging.id },
				});
				return { reason: gate.reason, status: "refused" };
			}
			const outcome = await commitClip({
				clip: staged.clip,
				idempotencyKey: staged.idempotencyKey,
				link: gate.link,
				target: staged.target,
			});
			if (outcome.status === "saved") {
				await input.prisma.mutationStagingOperation.update({
					data: { status: COMMITTED },
					where: { id: staging.id },
				});
			}
			return outcome;
		},
		historyCollection(): false {
			return false;
		},
		async issuePairingCode(): Promise<IssuePairingCodeOutcome> {
			if (!input.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const now = input.clock.now();
			await input.prisma.capturePairingCode.deleteMany({
				where: {
					consumedAt: null,
					ownerId: input.actorId,
					workspaceId: input.workspaceId,
				},
			});
			const code = generatePairingCode();
			const expiresAt = new Date(now.getTime() + PAIRING_CODE_TTL_MS);
			await input.prisma.capturePairingCode.create({
				data: {
					codeHash: hashSecret(code),
					expiresAt,
					id: crypto.randomUUID(),
					ownerId: input.actorId,
					workspaceId: input.workspaceId,
				},
			});
			input.logs.push("issued pairing code");
			return { code, expiresAt, status: "issued" };
		},
		kaynakRecords(): readonly never[] {
			return [];
		},
		async listExtensionLinks(): Promise<ExtensionLinkView[]> {
			const rows = await input.prisma.captureExtensionLink.findMany({
				orderBy: { createdAt: "asc" },
				where: {
					ownerId: input.actorId,
					revokedAt: null,
					workspaceId: input.workspaceId,
				},
			});
			return rows.map(toLinkView);
		},
		livePageCopies(): readonly never[] {
			return [];
		},
		logs() {
			return input.logs;
		},
		pageInjection(clip: WebCaptureClip) {
			return pageInjectionFor(clip);
		},
		async pair(command: {
			browser: string;
			code: string;
			device: string;
			family: string;
		}): Promise<PairExtensionOutcome> {
			if (!input.connected()) {
				return { reason: "offline", status: "refused" };
			}
			if (!isClipperBrowserFamily(command.family)) {
				return { reason: "unsupported-browser", status: "refused" };
			}
			const now = input.clock.now();
			const row = await input.prisma.capturePairingCode.findUnique({
				where: { codeHash: hashSecret(command.code) },
			});
			if (
				!row ||
				row.consumedAt ||
				row.expiresAt.getTime() <= now.getTime() ||
				row.ownerId !== input.actorId ||
				row.workspaceId !== input.workspaceId
			) {
				return { reason: "unpaired", status: "refused" };
			}
			const consumed = await input.prisma.capturePairingCode.updateMany({
				data: { consumedAt: now },
				where: { consumedAt: null, id: row.id },
			});
			if (consumed.count !== 1) {
				return { reason: "unpaired", status: "refused" };
			}
			const token = generateLinkToken();
			const link = await input.prisma.captureExtensionLink.create({
				data: {
					browser: command.browser,
					device: command.device,
					family: command.family,
					id: crypto.randomUUID(),
					lastUsedAt: now,
					ownerId: input.actorId,
					tokenHash: hashSecret(token),
					workspaceId: input.workspaceId,
				},
			});
			input.logs.push(`paired ${command.browser}`);
			return {
				link: toLinkView(link),
				status: "paired",
				token,
			};
		},
		previewWebCapture(command: {
			clip: WebCaptureClip;
			target: WebCaptureTarget;
		}): WebCapturePreview {
			return previewWebCaptureView(command);
		},
		async revokeAllExtensionLinks(): Promise<{ status: "revoked" }> {
			const now = input.clock.now();
			await input.prisma.captureExtensionLink.updateMany({
				data: { revokedAt: now },
				where: {
					ownerId: input.actorId,
					revokedAt: null,
					workspaceId: input.workspaceId,
				},
			});
			return { status: "revoked" };
		},
		async revokeExtensionLink(command: {
			id: string;
		}): Promise<{ status: "revoked" } | { status: "not-found" }> {
			const now = input.clock.now();
			const updated = await input.prisma.captureExtensionLink.updateMany({
				data: { revokedAt: now },
				where: {
					id: command.id,
					ownerId: input.actorId,
					revokedAt: null,
					workspaceId: input.workspaceId,
				},
			});
			if (updated.count !== 1) {
				return { status: "not-found" };
			}
			return { status: "revoked" };
		},
		async searchCaptureTargets(command: { query?: string }): Promise<{
			projects: ProjectCaptureTargetInbox[];
			workspace: CaptureTargetInbox;
		}> {
			const query = command.query?.trim() ?? "";
			const rows = await input.prisma.project.findMany({
				orderBy: { name: "asc" },
				select: { id: true, name: true },
				where: {
					workspaceId: input.workspaceId,
					...(query
						? { name: { contains: query, mode: "insensitive" as const } }
						: {}),
				},
			});
			return {
				projects: rows.map((project) => ({
					kind: "project" as const,
					label: CAPTURE_INBOX_COPY.projectCaptureInbox,
					projectId: project.id,
					projectName: project.name,
				})),
				workspace: {
					kind: "workspace",
					label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
				},
			};
		},
		sendPayload: sendPayloadFor,
		async sendWebCapture(command: {
			clip: WebCaptureClip;
			idempotencyKey: string;
			target: WebCaptureTarget;
			token: string;
		}): Promise<SendWebCaptureOutcome> {
			if (!input.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const link = await findLinkByToken(command.token);
			const gate = linkWriteGate(link, input.clock.now());
			if (!gate.ok) {
				return { reason: gate.reason, status: "refused" };
			}
			return await commitClip({
				clip: command.clip,
				idempotencyKey: command.idempotencyKey,
				link: gate.link,
				target: command.target,
			});
		},
		async stageWebCapture(command: {
			clip: WebCaptureClip;
			idempotencyKey: string;
			target: WebCaptureTarget;
			token: string;
		}): Promise<StageWebCaptureOutcome> {
			if (!input.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const link = await findLinkByToken(command.token);
			const gate = linkWriteGate(link, input.clock.now());
			if (!gate.ok) {
				return { reason: gate.reason, status: "refused" };
			}
			const payload = clipPayload(command.clip, command.target);
			const fingerprint = payloadFingerprint(payload);
			const existing = await readReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			const existingStaging =
				await input.prisma.mutationStagingOperation.findUnique({
					where: { commandKey: command.idempotencyKey },
				});
			if (existingStaging) {
				return await reuseExistingStaging(
					input.prisma,
					existingStaging,
					command,
					fingerprint,
					gate.link.id
				);
			}
			const stagingId = crypto.randomUUID();
			const now = input.clock.now();
			await input.prisma.mutationStagingOperation.create({
				data: {
					actorId: input.actorId,
					baseRevision: 0,
					commandKey: command.idempotencyKey,
					expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_MS),
					id: stagingId,
					origin: "human",
					payloadFingerprint: fingerprint,
					payloadJson: stagedPayloadJson(command, gate.link.id),
					status: STAGED,
					targetId: gate.link.id,
					targetScope: targetScopeFor(command.target),
				},
			});
			return { stagingId, status: "staged" };
		},
		wideReadWarning,
	};
}

export type WebCapture = ReturnType<typeof createWebCapture>;
