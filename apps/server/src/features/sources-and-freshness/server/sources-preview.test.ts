/**
 * Sources and Freshness seam — isolated smart link preview.
 * Egress is an adapter: the hop transport is a test double,
 * deny-private still runs on every DNS result and redirect.
 * docs/specs/44-sources-and-freshness/spec.md and GitHub #311.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt tazeliği).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";

import type { IsolatedHopTransport, IsolatedHttpHop } from "./isolated-egress";
import { createSource, getSource, listSources } from "./sources";
import { SOURCES_COPY } from "./sources-model";
import { previewSmartLink } from "./sources-preview";

const SCRIPT_TAG = /<script>/i;
const DATA_PNG = /^data:image\/png;base64,/;
const DATABASE_URL = localTestDatabaseUrl();
const PUBLIC_IPV4 = "93.184.216.34";
const STRIPE_URL = "https://docs.stripe.com/payments/checkout";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const YOUTUBE_RESTRICTED_URL = "https://www.youtube.com/watch?v=restricted9";
const VIMEO_URL = "https://vimeo.com/123456789";
const PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64"
);

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

function htmlPage(input: {
	description?: string;
	image?: string;
	title: string;
}): string {
	const description = input.description
		? `<meta property="og:description" content="${input.description}">`
		: "";
	const image = input.image
		? `<meta property="og:image" content="${input.image}">`
		: "";
	return `<!doctype html><html><head><title>${input.title}</title><meta property="og:title" content="${input.title}">${description}${image}<script>document.title="owned"</script></head><body><h1>${input.title}</h1></body></html>`;
}

function scriptedTransport(script: {
	dns?: Record<string, string[]>;
	hops: Record<string, IsolatedHttpHop>;
}): IsolatedHopTransport & { requestedUrls: string[] } {
	const requestedUrls: string[] = [];
	return {
		request: (url: URL, _pinnedIp: string): Promise<IsolatedHttpHop> => {
			requestedUrls.push(url.href);
			const hop =
				script.hops[url.href] ?? script.hops[`${url.origin}${url.pathname}`];
			if (!hop) {
				throw new Error(`unexpected hop ${url.href}`);
			}
			return Promise.resolve(hop);
		},
		requestedUrls,
		resolve: (hostname: string): Promise<string[]> => {
			if (script.dns?.[hostname]) {
				return Promise.resolve(script.dns[hostname]);
			}
			return Promise.resolve([PUBLIC_IPV4]);
		},
	};
}

describe("Sources and Freshness", () => {
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

	it("shows title, domain, and a safe image for a public HTTP(S) paste without creating a Source", async () => {
		const { projectId } = await openPayments(prisma);
		const imageUrl = "https://cdn.stripe.com/og.png";
		const transport = scriptedTransport({
			hops: {
				[STRIPE_URL]: {
					body: htmlPage({
						description: "Checkout Session creates a payment page.",
						image: imageUrl,
						title: "Stripe Checkout",
					}),
					contentType: "text/html; charset=utf-8",
					status: 200,
				},
				[imageUrl]: {
					body: PIXEL_PNG,
					contentType: "image/png",
					status: 200,
				},
			},
		});
		const preview = await previewSmartLink(STRIPE_URL, { transport });
		expect(preview.status).toBe("preview");
		if (preview.status !== "preview") {
			throw new Error("expected preview");
		}
		expect(preview.isSource).toBe(false);
		expect(preview.kind).toBe("rich");
		expect(preview.title).toBe("Stripe Checkout");
		expect(preview.domain).toBe("docs.stripe.com");
		expect(preview.originalUrl).toBe(STRIPE_URL);
		expect(preview.description).toBe(
			"Checkout Session creates a payment page."
		);
		expect(preview.imageDataUrl).toMatch(DATA_PNG);
		expect(preview.player).toBeNull();
		expect(preview.capturedContent).not.toMatch(SCRIPT_TAG);
		expect(preview.capturedContent).not.toContain("owned");
		expect(await listSources(prisma, projectId)).toEqual([]);
	});

	it("falls back to a plain link for private, credential, oversized, executable, and non-HTTP targets", async () => {
		const transport = scriptedTransport({
			dns: {
				"intranet.example": ["10.0.0.8"],
				"open.example": [PUBLIC_IPV4],
			},
			hops: {
				"http://127.0.0.1/secret": {
					body: htmlPage({ title: "metadata" }),
					contentType: "text/html",
					status: 200,
				},
				"https://cdn.example/app.js": {
					body: "alert(1)",
					contentType: "application/javascript",
					status: 200,
				},
				"https://docs.stripe.com/payments/checkout": {
					body: "x".repeat(20 * 1024 * 1024 + 1),
					contentType: "text/html",
					headers: { "content-length": String(20 * 1024 * 1024 + 1) },
					status: 200,
				},
				"https://open.example/go": {
					body: "",
					headers: { location: "http://127.0.0.1/secret" },
					status: 302,
				},
			},
		});

		const loopback = await previewSmartLink("http://127.0.0.1/", { transport });
		expect(loopback).toEqual({
			reason: "denied-target",
			status: "plain-link",
			url: "http://127.0.0.1/",
		});

		const linkLocal = await previewSmartLink("http://169.254.169.254/", {
			transport,
		});
		expect(linkLocal.status).toBe("plain-link");
		if (linkLocal.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(linkLocal.reason).toBe("denied-target");

		const privateHost = await previewSmartLink("https://intranet.example/", {
			transport,
		});
		expect(privateHost.status).toBe("plain-link");
		if (privateHost.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(privateHost.reason).toBe("denied-target");

		const redirected = await previewSmartLink("https://open.example/go", {
			transport,
		});
		expect(redirected.status).toBe("plain-link");
		if (redirected.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(redirected.reason).toBe("denied-target");
		expect(transport.requestedUrls).not.toContain("http://127.0.0.1/secret");

		const credentials = await previewSmartLink(
			"https://user:secret@docs.stripe.com/payments/checkout",
			{ transport }
		);
		expect(credentials.status).toBe("plain-link");
		if (credentials.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(credentials.reason).toBe("credentials");

		const oversized = await previewSmartLink(STRIPE_URL, { transport });
		expect(oversized.status).toBe("plain-link");
		if (oversized.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(oversized.reason).toBe("oversized");

		const executable = await previewSmartLink("https://cdn.example/app.js", {
			transport,
		});
		expect(executable.status).toBe("plain-link");
		if (executable.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(executable.reason).toBe("executable");

		const otherProtocol = await previewSmartLink("file:///etc/passwd", {
			transport,
		});
		expect(otherProtocol.status).toBe("plain-link");
		if (otherProtocol.status !== "plain-link") {
			throw new Error("expected plain link");
		}
		expect(otherProtocol.reason).toBe("unsupported");
	});

	it("turns Save as Source into a historical snapshot that later egress changes do not rewrite", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const hops: Record<string, IsolatedHttpHop> = {
			[STRIPE_URL]: {
				body: htmlPage({
					description: "First capture of checkout copy.",
					title: "Stripe Checkout",
				}),
				contentType: "text/html",
				status: 200,
			},
		};
		const transport = scriptedTransport({ hops });
		const preview = await previewSmartLink(STRIPE_URL, { transport });
		expect(preview.status).toBe("preview");
		if (preview.status !== "preview") {
			throw new Error("expected preview");
		}
		expect(preview.isSource).toBe(false);
		const created = await createSource(prisma, {
			actorId,
			idempotencyKey: "save-preview-as-source",
			origin: "human",
			payload: {
				accessedAt: "2026-03-02T09:15:00.000Z",
				capturedContent: preview.capturedContent,
				projectId,
				title: preview.title,
				url: preview.originalUrl,
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		hops[STRIPE_URL] = {
			body: htmlPage({
				description: "Live page rewritten after save.",
				title: "New live title",
			}),
			contentType: "text/html",
			status: 200,
		};
		const laterPreview = await previewSmartLink(STRIPE_URL, { transport });
		expect(laterPreview.status).toBe("preview");
		if (laterPreview.status !== "preview") {
			throw new Error("expected later preview");
		}
		expect(laterPreview.title).toBe("New live title");
		const loaded = await getSource(prisma, created.source.id);
		expect(loaded?.title).toBe("Stripe Checkout");
		expect(loaded?.capturedContent).toBe(preview.capturedContent);
		expect(loaded?.capturedContent).toBe("First capture of checkout copy.");
		expect(loaded?.accessedAt).toBe("2026-03-02T09:15:00.000Z");
		expect(loaded?.url).toBe(STRIPE_URL);
	});

	it("treats YouTube as the only click-to-load player and never turns Vimeo or pasted iframe into a player", async () => {
		const transport = scriptedTransport({
			hops: {
				"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg": {
					body: PIXEL_PNG,
					contentType: "image/jpeg",
					status: 200,
				},
				"https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ":
					{
						body: JSON.stringify({
							thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
							title: "Never Gonna Give You Up",
						}),
						contentType: "application/json",
						status: 200,
					},
				"https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Drestricted9":
					{
						body: "",
						contentType: "application/json",
						status: 401,
					},
				[VIMEO_URL]: {
					body: htmlPage({
						description: "Conference talk",
						title: "Talk on Vimeo",
					}),
					contentType: "text/html",
					status: 200,
				},
			},
		});

		const youtube = await previewSmartLink(YOUTUBE_URL, { transport });
		expect(youtube.status).toBe("preview");
		if (youtube.status !== "preview") {
			throw new Error("expected youtube preview");
		}
		expect(youtube.kind).toBe("youtube");
		expect(youtube.title).toBe("Never Gonna Give You Up");
		expect(youtube.domain).toBe("www.youtube.com");
		expect(youtube.originalUrl).toBe(YOUTUBE_URL);
		expect(youtube.player).toEqual({
			autoplay: false,
			available: true,
			clickToLoad: true,
			embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0",
			error: null,
			provider: "youtube",
			videoId: "dQw4w9WgXcQ",
		});
		expect(youtube.isSource).toBe(false);

		const restricted = await previewSmartLink(YOUTUBE_RESTRICTED_URL, {
			transport,
		});
		expect(restricted.status).toBe("preview");
		if (restricted.status !== "preview") {
			throw new Error("expected restricted youtube");
		}
		expect(restricted.kind).toBe("youtube");
		expect(restricted.player).toEqual({
			autoplay: false,
			available: false,
			clickToLoad: true,
			embedUrl: null,
			error: SOURCES_COPY.youtubeUnavailable,
			provider: "youtube",
			videoId: "restricted9",
		});
		expect(restricted.originalUrl).toBe(YOUTUBE_RESTRICTED_URL);

		const vimeo = await previewSmartLink(VIMEO_URL, { transport });
		expect(vimeo.status).toBe("preview");
		if (vimeo.status !== "preview") {
			throw new Error("expected vimeo preview");
		}
		expect(vimeo.kind).toBe("rich");
		expect(vimeo.title).toBe("Talk on Vimeo");
		expect(vimeo.domain).toBe("vimeo.com");
		expect(vimeo.player).toBeNull();

		const pastedIframe = await previewSmartLink(
			'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
			{ transport }
		);
		expect(pastedIframe).toEqual({
			reason: "iframe-embed",
			status: "plain-link",
			url: '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
		});
	});

	it("uses English Save as Source and Live external source labels", () => {
		expect(SOURCES_COPY.saveAsSource).toBe("Save as Source");
		expect(SOURCES_COPY.liveExternalSource).toBe("Live external source");
		expect(SOURCES_COPY.livePreview).toBe("Live preview");
		expect(SOURCES_COPY.historicalSnapshot).toBe("Historical snapshot");
	});
});
