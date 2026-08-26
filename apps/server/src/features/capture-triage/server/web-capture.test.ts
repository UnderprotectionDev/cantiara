/**
 * Capture Inbox seam — Web Yakalama: paired WXT clipper send,
 * five-minute one-time pairing, revoke, 30-day re-auth, idempotency,
 * unpaired write refusal, no offline queue, Chromium and Firefox
 * counterparts, no Safari claim. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Yakalama) extension package.
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { type CaptureInbox, createCaptureInbox } from "./capture-inbox";
import { CAPTURE_INBOX_COPY } from "./capture-inbox-model";
import {
	CLIPPER_BROWSER_FAMILIES,
	PAIRING_CODE_TTL_MS,
	UNUSED_LINK_REAUTH_MS,
	WEB_CAPTURE_COPY,
	type WebCaptureClip,
} from "./web-capture-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara"; // pragma: allowlist secret

const CAPTURED_AT = new Date("2026-08-26T12:00:00.000Z");
const CLIPPER_FAMILIES = ["chromium", "firefox"] as const;
const PAIRING_CODE_PATTERN = /^[A-Z2-9]{8}$/;

const URL_CLIP: WebCaptureClip = {
	kind: "url",
	originUrl: "https://example.com/bug",
};

describe("Capture Inbox Web Capture catalog", () => {
	it("lists Chromium family and Firefox and does not claim Safari", () => {
		const capture = createCaptureInbox({
			actorId: crypto.randomUUID(),
			clock: { now: () => CAPTURED_AT },
			prisma: {} as PrismaClient,
			workspaceId: crypto.randomUUID(),
		});
		expect(capture.clipperBrowserFamilies()).toEqual(CLIPPER_BROWSER_FAMILIES);
		expect(capture.claimsSafariClipper()).toBe(false);
		expect(WEB_CAPTURE_COPY.webCapture).toBe("Web Capture");
		expect(WEB_CAPTURE_COPY.pairingCode).toBe("Pairing code");
		expect(WEB_CAPTURE_COPY.extensionLinks).toBe("Extension links");
		expect(WEB_CAPTURE_COPY.originUrl).toBe("Origin URL");
		expect(WEB_CAPTURE_COPY.targetInbox).toBe("Target Inbox");
		expect(WEB_CAPTURE_COPY.send).toBe("Send");
		expect(WEB_CAPTURE_COPY.searchInbox).toBe("Search Inbox");
		expect(WEB_CAPTURE_COPY.revoke).toBe("Revoke");
		expect(WEB_CAPTURE_COPY.device).toBe("Device");
		expect(WEB_CAPTURE_COPY.browser).toBe("Browser");
		expect(WEB_CAPTURE_COPY.lastUse).toBe("Last use");
		expect(WEB_CAPTURE_COPY.pair).toBe("Pair");
		expect(WEB_CAPTURE_COPY.sent).toBe("Sent to Capture Inbox.");
		expect(WEB_CAPTURE_COPY.unsupportedBrowser).toBe(
			"This browser cannot pair with Web Capture."
		);
		expect(WEB_CAPTURE_COPY.lastSuccessfulSave).toBe("Last successful save");
	});
});

describe("Capture Inbox Web Capture", () => {
	let actorId: string;
	let prisma: PrismaClient;
	let pool: Pool;
	let workspaceId: string;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		actorId = crypto.randomUUID();
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		const user = await prisma.user.create({
			data: {
				email: `${actorId}@example.com`,
				emailVerified: true,
				id: actorId,
				name: "Founder",
			},
		});
		const workspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Solo",
				ownerId: user.id,
			},
		});
		workspaceId = workspace.id;
	});

	afterEach(async () => {
		await prisma.mutationStagingOperation.deleteMany({
			where: { actorId },
		});
		await prisma.mutationReceipt.deleteMany({
			where: { actorId },
		});
		await prisma.captureInboxItem.deleteMany({
			where: { ownerId: actorId },
		});
		await prisma.captureExtensionLink.deleteMany({
			where: { ownerId: actorId },
		});
		await prisma.capturePairingCode.deleteMany({
			where: { ownerId: actorId },
		});
		await prisma.project.deleteMany({ where: { workspaceId } });
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function inbox(overrides: { connected?: boolean } = {}): CaptureInbox {
		return createCaptureInbox({
			actorId,
			clock: { now: () => CAPTURED_AT },
			connected: overrides.connected,
			prisma,
			workspaceId,
		});
	}

	async function pairClipper(
		capture: CaptureInbox,
		family: (typeof CLIPPER_FAMILIES)[number] = "chromium"
	) {
		const issued = await capture.issuePairingCode();
		if (issued.status !== "issued") {
			throw new Error("expected pairing code");
		}
		const paired = await capture.pair({
			browser: family === "firefox" ? "Firefox" : "Chrome",
			code: issued.code,
			device: "Mac",
			family,
		});
		if (paired.status !== "paired") {
			throw new Error("expected paired clipper");
		}
		return { issued, paired };
	}

	async function seedProject(name: string, shortCode: string) {
		return await prisma.project.create({
			data: {
				id: crypto.randomUUID(),
				lifecycleStatus: "Active",
				name,
				revision: 1,
				shortCode,
				starterConfiguration: "Blank Project",
				workspaceId,
			},
		});
	}

	it("refuses an unpaired client write and does not create an Inbox item", async () => {
		const capture = inbox();
		const outcome = await capture.sendWebCapture({
			clip: URL_CLIP,
			idempotencyKey: crypto.randomUUID(),
			target: {
				kind: "workspace",
				label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
			},
			token: "unpaired-token",
		});
		expect(outcome).toEqual({
			reason: "unpaired",
			status: "refused",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
	});

	it("issues a five-minute one-time pairing code and refuses reuse and expiry", async () => {
		const capture = inbox();
		const issued = await capture.issuePairingCode();
		expect(issued).toEqual({
			code: expect.stringMatching(PAIRING_CODE_PATTERN),
			expiresAt: new Date(CAPTURED_AT.getTime() + PAIRING_CODE_TTL_MS),
			status: "issued",
		});
		if (issued.status !== "issued") {
			throw new Error("expected issued code");
		}
		const first = await capture.pair({
			browser: "Chrome",
			code: issued.code,
			device: "Mac",
			family: "chromium",
		});
		expect(first.status).toBe("paired");
		expect(
			await capture.pair({
				browser: "Chrome",
				code: issued.code,
				device: "Mac",
				family: "chromium",
			})
		).toEqual({ reason: "unpaired", status: "refused" });

		const expiring = inbox();
		const timed = await expiring.issuePairingCode();
		if (timed.status !== "issued") {
			throw new Error("expected issued code");
		}
		expiring.advanceTime(
			new Date(CAPTURED_AT.getTime() + PAIRING_CODE_TTL_MS + 1)
		);
		expect(
			await expiring.pair({
				browser: "Firefox",
				code: timed.code,
				device: "Linux",
				family: "firefox",
			})
		).toEqual({ reason: "unpaired", status: "refused" });
	});

	it("lists device, browser, and last use and revokes one link", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		expect(await capture.listExtensionLinks()).toEqual([
			{
				browser: "Chrome",
				device: "Mac",
				id: paired.link.id,
				lastUsedAt: CAPTURED_AT,
			},
		]);
		expect(await capture.revokeExtensionLink({ id: paired.link.id })).toEqual({
			status: "revoked",
		});
		expect(await capture.listExtensionLinks()).toEqual([]);
		expect(
			await capture.sendWebCapture({
				clip: URL_CLIP,
				idempotencyKey: crypto.randomUUID(),
				target: {
					kind: "workspace",
					label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
				},
				token: paired.token,
			})
		).toEqual({ reason: "pairing-revoked", status: "refused" });
	});

	it("previews content, origin URL, and target Inbox before send", async () => {
		const capture = inbox();
		const project = await seedProject("Cantiara", "CAN");
		const clip: WebCaptureClip = {
			kind: "selected-text",
			originUrl: "https://example.com/thread",
			selectedText: "Login button does nothing",
		};
		expect(
			capture.previewWebCapture({
				clip,
				target: {
					kind: "project",
					label: CAPTURE_INBOX_COPY.projectCaptureInbox,
					projectId: project.id,
					projectName: "Cantiara",
				},
			})
		).toEqual({
			content: {
				attachmentRef: null,
				body: "Login button does nothing",
				kind: "selected-text",
			},
			originUrl: "https://example.com/thread",
			target: {
				kind: "project",
				label: CAPTURE_INBOX_COPY.projectCaptureInbox,
				projectId: project.id,
				projectName: "Cantiara",
			},
		});
	});

	it("searches every authorized Project Inbox, not only recently opened ones", async () => {
		const capture = inbox();
		const recent = await seedProject("Cantiara", "CAN");
		const archive = await seedProject("Archive Tool", "ARC");
		const targets = await capture.searchCaptureTargets({ query: "Archive" });
		expect(targets.workspace).toEqual({
			kind: "workspace",
			label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		});
		expect(targets.projects).toEqual([
			{
				kind: "project",
				label: CAPTURE_INBOX_COPY.projectCaptureInbox,
				projectId: archive.id,
				projectName: "Archive Tool",
			},
		]);
		expect(targets.projects.map((project) => project.projectId)).not.toContain(
			recent.id
		);
	});

	it.each(
		CLIPPER_FAMILIES
	)("sends URL, selected text, selected image, and screenshot from %s to the Inbox, not a main record", async (family) => {
		const capture = inbox();
		const { paired } = await pairClipper(capture, family);
		const target = {
			kind: "workspace" as const,
			label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		};
		const url = await capture.sendWebCapture({
			clip: URL_CLIP,
			idempotencyKey: crypto.randomUUID(),
			target,
			token: paired.token,
		});
		const text = await capture.sendWebCapture({
			clip: {
				kind: "selected-text",
				originUrl: "https://example.com/bug",
				selectedText: "Crash on save",
			},
			idempotencyKey: crypto.randomUUID(),
			target,
			token: paired.token,
		});
		const image = await capture.sendWebCapture({
			clip: {
				kind: "selected-image",
				originUrl: "https://example.com/bug",
				selectedImage: "staging-image",
			},
			idempotencyKey: crypto.randomUUID(),
			target,
			token: paired.token,
		});
		const shot = await capture.sendWebCapture({
			clip: {
				kind: "screenshot",
				originUrl: "https://example.com/bug",
				screenshot: "staging-shot",
			},
			idempotencyKey: crypto.randomUUID(),
			target,
			token: paired.token,
		});
		expect(url).toMatchObject({
			item: {
				body: "https://example.com/bug",
				kind: "capture-inbox-item",
				link: "https://example.com/bug",
				origin: "https://example.com/bug",
				scope: { kind: "workspace" },
			},
			mainRecord: null,
			status: "saved",
		});
		expect(text).toMatchObject({
			item: { body: "Crash on save", kind: "capture-inbox-item" },
			mainRecord: null,
			status: "saved",
		});
		expect(image).toMatchObject({
			item: {
				attachmentRef: "staging-image",
				kind: "capture-inbox-item",
			},
			mainRecord: null,
			status: "saved",
		});
		expect(shot).toMatchObject({
			item: {
				attachmentRef: "staging-shot",
				kind: "capture-inbox-item",
			},
			mainRecord: null,
			status: "saved",
		});
		expect(await capture.list({ kind: "workspace" })).toHaveLength(4);
		expect(capture.kaynakRecords()).toEqual([]);
		expect(capture.livePageCopies()).toEqual([]);
		expect(capture.clipArchive()).toEqual([]);
		expect(capture.backgroundScan()).toBe(false);
		expect(capture.historyCollection()).toBe(false);
		expect(capture.claimsSafariClipper()).toBe(false);
	});

	it("returns the previous result for the same key and fingerprint and conflicts when content changes", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		const key = crypto.randomUUID();
		const target = {
			kind: "workspace" as const,
			label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		};
		const first = await capture.sendWebCapture({
			clip: URL_CLIP,
			idempotencyKey: key,
			target,
			token: paired.token,
		});
		expect(
			await capture.sendWebCapture({
				clip: URL_CLIP,
				idempotencyKey: key,
				target,
				token: paired.token,
			})
		).toEqual(first);
		expect(
			await capture.sendWebCapture({
				clip: {
					kind: "url",
					originUrl: "https://example.com/changed",
				},
				idempotencyKey: key,
				target,
				token: paired.token,
			})
		).toEqual({ reason: MUTATION_COPY.conflict, status: "conflict" });
		expect(await capture.list({ kind: "workspace" })).toHaveLength(1);
	});

	it("stages then finalizes a send and replays the same key without a second Inbox item", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		const key = crypto.randomUUID();
		const target = {
			kind: "workspace" as const,
			label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		};
		const staged = await capture.stageWebCapture({
			clip: URL_CLIP,
			idempotencyKey: key,
			target,
			token: paired.token,
		});
		expect(staged).toEqual({
			stagingId: expect.any(String),
			status: "staged",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		if (staged.status !== "staged") {
			throw new Error("expected staged send");
		}
		const first = await capture.finalizeWebCapture({
			stagingId: staged.stagingId,
		});
		expect(first).toMatchObject({
			mainRecord: null,
			status: "saved",
		});
		const stagedAgain = await capture.stageWebCapture({
			clip: URL_CLIP,
			idempotencyKey: key,
			target,
			token: paired.token,
		});
		expect(stagedAgain).toEqual({
			stagingId: staged.stagingId,
			status: "staged",
		});
		if (stagedAgain.status !== "staged") {
			throw new Error("expected restaged send");
		}
		expect(
			await capture.finalizeWebCapture({ stagingId: stagedAgain.stagingId })
		).toEqual(first);
		expect(await capture.list({ kind: "workspace" })).toHaveLength(1);
	});

	it("stages then finalizes a send and replays the same key without a second Inbox item", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		const key = crypto.randomUUID();
		const target = {
			kind: "workspace" as const,
			label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		};
		const staged = await capture.stageWebCapture({
			clip: URL_CLIP,
			idempotencyKey: key,
			target,
			token: paired.token,
		});
		expect(staged).toEqual({
			stagingId: expect.any(String),
			status: "staged",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		if (staged.status !== "staged") {
			throw new Error("expected staged send");
		}
		const first = await capture.finalizeWebCapture({
			stagingId: staged.stagingId,
		});
		expect(first).toMatchObject({
			mainRecord: null,
			status: "saved",
		});
		const stagedAgain = await capture.stageWebCapture({
			clip: URL_CLIP,
			idempotencyKey: key,
			target,
			token: paired.token,
		});
		expect(stagedAgain).toEqual({
			stagingId: staged.stagingId,
			status: "staged",
		});
		if (stagedAgain.status !== "staged") {
			throw new Error("expected restaged send");
		}
		expect(
			await capture.finalizeWebCapture({ stagingId: stagedAgain.stagingId })
		).toEqual(first);
		expect(await capture.list({ kind: "workspace" })).toHaveLength(1);
	});

	it("does not inject the pairing token into page content, logs, or the capture payload", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		const clip: WebCaptureClip = {
			kind: "selected-text",
			originUrl: "https://example.com/bug",
			selectedText: "Crash on save",
		};
		const sent = await capture.sendWebCapture({
			clip,
			idempotencyKey: crypto.randomUUID(),
			target: {
				kind: "workspace",
				label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
			},
			token: paired.token,
		});
		expect(JSON.stringify(capture.pageInjection(clip))).not.toContain(
			paired.token
		);
		expect(JSON.stringify(capture.sendPayload(clip))).not.toContain(
			paired.token
		);
		expect(capture.logs().join("\n")).not.toContain(paired.token);
		if (sent.status !== "saved") {
			throw new Error("expected saved clip");
		}
		expect(JSON.stringify(sent.item)).not.toContain(paired.token);
	});

	it("does not silently widen a clip when wide page read is declined", () => {
		const capture = inbox();
		const clipped = capture.clip({
			kind: "selected-text",
			page: {
				fullPageText:
					"Login button does nothing and the rest of the secret page",
				originUrl: "https://example.com/app",
				selectedText: "Login button does nothing",
			},
			wideReadGranted: false,
		});
		expect(clipped).toEqual({
			clip: {
				kind: "selected-text",
				originUrl: "https://example.com/app",
				selectedText: "Login button does nothing",
			},
			permissionDeclinedMessage: WEB_CAPTURE_COPY.permissionDeclined,
			widened: false,
		});
		expect(clipped.clip.selectedText).not.toContain("secret page");
		expect(capture.wideReadWarning()).toEqual({
			risk: WEB_CAPTURE_COPY.sensitivePage,
			scope: WEB_CAPTURE_COPY.wideReadPermission,
		});
	});

	it("writes nothing when pairing is revoked before finalize", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		const staged = await capture.stageWebCapture({
			clip: URL_CLIP,
			idempotencyKey: crypto.randomUUID(),
			target: {
				kind: "workspace",
				label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
			},
			token: paired.token,
		});
		expect(staged).toEqual({
			stagingId: expect.any(String),
			status: "staged",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		if (staged.status !== "staged") {
			throw new Error("expected staged send");
		}
		await capture.revokeExtensionLink({ id: paired.link.id });
		expect(
			await capture.finalizeWebCapture({ stagingId: staged.stagingId })
		).toEqual({
			reason: "pairing-revoked",
			status: "refused",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
	});

	it("refuses a write after 30 unused days until re-authorization", async () => {
		const capture = inbox();
		const { paired } = await pairClipper(capture);
		capture.advanceTime(
			new Date(CAPTURED_AT.getTime() + UNUSED_LINK_REAUTH_MS + 1)
		);
		expect(
			await capture.sendWebCapture({
				clip: URL_CLIP,
				idempotencyKey: crypto.randomUUID(),
				target: {
					kind: "workspace",
					label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
				},
				token: paired.token,
			})
		).toEqual({
			reason: "reauthorization-required",
			status: "refused",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		const reissued = await capture.issuePairingCode();
		if (reissued.status !== "issued") {
			throw new Error("expected reissued code");
		}
		const reauthorized = await capture.pair({
			browser: "Chrome",
			code: reissued.code,
			device: "Mac",
			family: "chromium",
		});
		if (reauthorized.status !== "paired") {
			throw new Error("expected reauthorization");
		}
		expect(
			await capture.sendWebCapture({
				clip: URL_CLIP,
				idempotencyKey: crypto.randomUUID(),
				target: {
					kind: "workspace",
					label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
				},
				token: reauthorized.token,
			})
		).toMatchObject({ mainRecord: null, status: "saved" });
	});

	it("refuses an offline Web Capture and never queues", async () => {
		const capture = inbox({ connected: false });
		expect(await capture.issuePairingCode()).toEqual({
			queued: false,
			reason: "offline",
			status: "refused",
		});
		expect(
			await capture.sendWebCapture({
				clip: URL_CLIP,
				idempotencyKey: crypto.randomUUID(),
				target: {
					kind: "workspace",
					label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
				},
				token: "offline",
			})
		).toEqual({ queued: false, reason: "offline", status: "refused" });
		expect(capture.writeQueue()).toEqual([]);
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
	});

	it("refuses a Safari pairing claim", async () => {
		const capture = inbox();
		const issued = await capture.issuePairingCode();
		if (issued.status !== "issued") {
			throw new Error("expected issued code");
		}
		expect(
			await capture.pair({
				browser: "Safari",
				code: issued.code,
				device: "Mac",
				family: "safari",
			})
		).toEqual({ reason: "unsupported-browser", status: "refused" });
		expect(await capture.listExtensionLinks()).toEqual([]);
	});
});
