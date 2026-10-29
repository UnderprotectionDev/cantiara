// biome-ignore-all lint/performance/useTopLevelRegex: Inline patterns assert one rendered string each.
import { describe, expect, test } from "vitest";

import { createLinkSharing, type ShareSource } from "../link-sharing";
import type { LinkPasswordHasher } from "../link-sharing-credentials";
import { createLinkSharingVisitorRoutes } from "../link-sharing-http";
import { createMemoryLinkSharing } from "../link-sharing-memory-store";
import { createLinkSharingVisitor } from "../link-sharing-visitor";

const ACCOUNT = "account-1";
const ORIGIN = "https://api.cantiara.example";
const VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const NONCE = /nonce-[\w-]+|nonce="[\w-]+"/g;
const TOKEN_FIELD = /name="token" value="[^"]*"/;
const ABSOLUTE_SRC = /(src|href)="https?:/;
const SCRIPT_BLOCK = /<script[\s\S]*<\/script>/;

const root = { id: "d1", kind: "Document" as const };
const source: ShareSource = {
  blockers: [],
  members: [],
  projectId: "project-1",
  record: {
    fields: [
      {
        key: "body",
        kind: "markdown",
        label: "Body",
        value: "Read <b>this</b> & that",
      },
    ],
    id: "d1",
    kind: "Document",
    parts: [
      {
        detail: VIDEO,
        id: "embed:video",
        kind: "Embed",
        label: "YouTube (Live external source, loads on click)",
      },
    ],
    title: "Plan",
  },
};
const approvedItemIds = [
  "record:Document:d1",
  "field:Document:d1:title",
  "field:Document:d1:body",
  "part:Document:d1:embed:video",
];

const hasher: LinkPasswordHasher = {
  hash: (password) => Promise.resolve(`h$${password}`),
  verify: (password, stored) => Promise.resolve(stored === `h$${password}`),
};

async function setup() {
  const harness = createMemoryLinkSharing({
    accountId: ACCOUNT,
    sources: [{ root, source }],
  });
  const founder = createLinkSharing(harness.store, { hasher });
  const visitor = createLinkSharingVisitor(harness.visitorStore, {
    hasher,
    rateSecret: "rate-secret-for-tests",
  });
  const routes = createLinkSharingVisitorRoutes({
    networkOf: () => "203.0.113.7",
    visitor,
  });
  const approved = await founder.approve(ACCOUNT, {
    approvalId: "approval-1",
    approvedItemIds,
    liveItemIds: [],
    publishAnyway: false,
    root,
  });
  return {
    founder,
    routes,
    surfaceId: approved?.surfaceId ?? "",
    token: approved?.accessToken ?? "",
  };
}

const get = (
  routes: Awaited<ReturnType<typeof setup>>["routes"],
  path: string,
  cookie?: string,
) =>
  routes.request(`${ORIGIN}${path}`, {
    headers: cookie ? { cookie } : {},
  });

const post = (
  routes: Awaited<ReturnType<typeof setup>>["routes"],
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) =>
  routes.request(`${ORIGIN}/s`, {
    body: new URLSearchParams(fields),
    headers: { origin: ORIGIN, ...headers },
    method: "POST",
  });

const cookieOf = (response: Response) =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

const normalized = async (response: Response, token: string) =>
  (await response.text())
    .replaceAll(NONCE, "nonce")
    .replace(TOKEN_FIELD, "T")
    .replaceAll(token, "T");

describe("Link Sharing visitor HTTP boundary", () => {
  test("the token exchange sets a surface-bound session cookie and redirects to a token-free clean URL", async () => {
    const { routes, surfaceId, token } = await setup();
    const response = await get(routes, `/s/${token}`);
    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toBe(`/shared/${surfaceId}`);
    expect(location).not.toContain(token);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__Secure-cantiara-share=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain(`Path=/shared/${surfaceId}`);
    // A session cookie: it ends when the browser closes.
    expect(setCookie).not.toMatch(/max-age|expires/i);
    expect(setCookie).not.toContain(token);

    const page = await get(routes, location, cookieOf(response));
    expect(page.status).toBe(200);
  });

  test("the clean URL does not work without that browser's cookie", async () => {
    const { routes, surfaceId, token } = await setup();
    const unknown = await get(routes, "/shared/not-a-surface");
    const noCookie = await get(routes, `/shared/${surfaceId}`);
    const founderCookie = await get(
      routes,
      `/shared/${surfaceId}`,
      "__Secure-better-auth.session_token=founder-session",
    );
    expect(noCookie.status).toBe(404);
    expect(founderCookie.status).toBe(404);
    // An unknown surface and a refused one are indistinguishable.
    const body = await normalized(unknown, token);
    expect(await normalized(noCookie, token)).toBe(body);
    expect(await normalized(founderCookie, token)).toBe(body);
  });

  test("a password gate answers a wrong password and an unknown token with one generic error", async () => {
    const { founder, routes, surfaceId, token } = await setup();
    await founder.setPassword(ACCOUNT, {
      password: "correct horse",
      surfaceId,
    });
    const gate = await get(routes, `/s/${token}`);
    expect(gate.status).toBe(200);
    const gateHtml = await gate.text();
    expect(gateHtml).toContain('type="password"');
    expect(gateHtml).toContain('for="password"');
    expect(gateHtml).not.toContain('role="alert"');

    const wrong = await post(routes, { password: "nope", token });
    const unknown = await post(routes, { password: "nope", token: "other" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const wrongHtml = await normalized(wrong, token);
    expect(wrongHtml).toContain('role="alert"');
    expect(wrongHtml).toContain('aria-invalid="true"');
    expect(wrongHtml).toContain('aria-describedby="gate-error"');
    expect(await normalized(unknown, "other")).toBe(wrongHtml);
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const right = await post(routes, { password: "correct horse", token });
    expect(right.status).toBe(303);
    expect(right.headers.get("set-cookie")).toContain(
      "__Secure-cantiara-share=",
    );
  });

  test("a form post from another origin is refused", async () => {
    const { routes, token } = await setup();
    const response = await post(
      routes,
      { password: "x", token },
      { origin: "https://evil.example" },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("the snapshot page is read-only HTML with no referrer, a restrictive CSP and noreferrer links", async () => {
    const { routes, surfaceId, token } = await setup();
    const exchange = await get(routes, `/s/${token}`);
    const response = await get(
      routes,
      `/shared/${surfaceId}`,
      cookieOf(exchange),
    );
    const html = await response.text();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    // Values are escaped text; the page offers no edit, comment or palette.
    expect(html).toContain("Read &lt;b&gt;this&lt;/b&gt; &amp; that");
    expect(html).not.toMatch(/<(form|textarea|input|select)/);
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain("Approved snapshot");
    expect(html).toContain("Last scope approval");
  });

  test("YouTube sends no request on page load and loads only after a click, without autoplay", async () => {
    const { routes, surfaceId, token } = await setup();
    const exchange = await get(routes, `/s/${token}`);
    const response = await get(
      routes,
      `/shared/${surfaceId}`,
      cookieOf(exchange),
    );
    const html = await response.text();
    expect(html).toContain("Live external source");
    expect(html).toContain("contacts YouTube");
    expect(html).toContain(VIDEO);
    expect(html).toContain('data-youtube="dQw4w9WgXcQ"');
    expect(html).toContain("Load YouTube video");
    // Nothing third-party is fetched by the markup: no frame, script or image source.
    expect(html).not.toMatch(/<iframe/);
    expect(html).not.toMatch(/<script[^>]*src=/);
    expect(html).not.toMatch(/<img/);
    expect(html.replaceAll(VIDEO, "").replace(SCRIPT_BLOCK, "")).not.toMatch(
      ABSOLUTE_SRC,
    );
    expect(html).not.toContain("iframe_api");
    expect(html).not.toMatch(/autoplay=1/);
    expect(html).toContain("autoplay=0");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toMatch(/script-src 'nonce-[\w-]+'/);
  });

  test("the password gate loads no script and no frame", async () => {
    const { routes, token } = await setup();
    const response = await get(routes, `/s/unknown-${token}`);
    expect(response.status).toBe(200);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(await response.text()).not.toContain("<script");
  });
});
