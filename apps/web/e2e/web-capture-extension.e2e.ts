import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  type BrowserContext,
  chromium,
  expect,
  firefox,
  test,
} from "@playwright/test";

const EXTENSION_ROOT = resolve(import.meta.dirname, "../../extension");
const CHROME_OUTPUT = join(EXTENSION_ROOT, ".output/chrome-mv3");
const FIREFOX_OUTPUT = join(EXTENSION_ROOT, ".output/firefox-mv2");
const PATH_PREFIX_PATTERN = /^\/+/u;

interface SendRequest {
  authorization: string | undefined;
  body: Record<string, unknown>;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function respond(
  response: ServerResponse,
  status: number,
  body: unknown,
  origin: string | undefined,
) {
  response.writeHead(status, {
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, OPTIONS, POST",
    "access-control-allow-origin": origin ?? "*",
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}

async function startFixtureServer() {
  const sendRequests: SendRequest[] = [];
  let sendAttempts = 0;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Fixture deliberately models each API route and retry response.
  const server = createServer(async (request, response) => {
    const { headers, method, url } = request;
    const { origin } = headers;
    if (method === "OPTIONS") {
      respond(response, 204, null, origin);
      return;
    }
    if (url === "/page") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<title>Acceptance article</title><p>Article body</p>");
      return;
    }
    if (url === "/api/web-capture/pair" && method === "POST") {
      const body = await readBody(request);
      respond(
        response,
        200,
        {
          link: {
            browser: body.browser,
            createdAt: "2026-09-18T09:00:00.000Z",
            device: body.device,
            id: "link-1",
            lastUse: null,
          },
          token: "extension-token",
        },
        origin,
      );
      return;
    }
    if (url?.startsWith("/api/web-capture/inboxes") && method === "GET") {
      respond(
        response,
        request.headers.authorization === "Bearer extension-token" ? 200 : 401,
        {
          targets: [
            {
              id: "workspace",
              label: "Workspace Capture Inbox",
              name: "Workspace",
              projectId: null,
            },
          ],
        },
        origin,
      );
      return;
    }
    if (url === "/api/web-capture/send" && method === "POST") {
      const body = await readBody(request);
      sendAttempts += 1;
      sendRequests.push({
        authorization: request.headers.authorization,
        body,
      });
      respond(
        response,
        sendAttempts === 1 ? 503 : 200,
        sendAttempts === 1
          ? { code: "WEB_CAPTURE_UNAVAILABLE", message: "Try again." }
          : { sent: true },
        origin,
      );
      return;
    }
    respond(response, 404, { message: "Not found." }, origin);
  });
  await new Promise<void>((resolveServer) => {
    server.listen(0, "127.0.0.1", resolveServer);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The extension fixture server did not start.");
  }
  return {
    close: () =>
      new Promise<void>((resolveServer, reject) => {
        server.close((error) => (error ? reject(error) : resolveServer()));
      }),
    resetSendAttempts: () => {
      sendAttempts = 0;
    },
    requests: sendRequests,
    url: `http://127.0.0.1:${address.port}`,
  };
}

function extensionContentType(pathname: string) {
  if (pathname.endsWith(".css")) {
    return "text/css";
  }
  if (pathname.endsWith(".js")) {
    return "text/javascript";
  }
  return "text/html";
}

async function startExtensionServer(root: string) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://127.0.0.1").pathname,
    );
    const relativePath =
      pathname.replace(PATH_PREFIX_PATTERN, "") || "popup.html";
    if (relativePath.includes("..")) {
      response.writeHead(400);
      response.end();
      return;
    }
    try {
      const body = readFileSync(join(root, relativePath));
      const contentType = extensionContentType(relativePath);
      response.writeHead(200, { "content-type": contentType });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolveServer) => {
    server.listen(0, "127.0.0.1", resolveServer);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The extension fixture server did not start.");
  }
  return {
    close: () =>
      new Promise<void>((resolveServer, reject) => {
        server.close((error) => (error ? reject(error) : resolveServer()));
      }),
    popupUrl: `http://127.0.0.1:${address.port}/popup.html`,
  };
}

function buildExtension(serverUrl: string) {
  const environment = {
    ...process.env,
    VITE_SERVER_URL: serverUrl,
  };
  execFileSync("bun", ["run", "build"], {
    cwd: EXTENSION_ROOT,
    env: environment,
    stdio: "inherit",
  });
  execFileSync("bun", ["run", "build:firefox"], {
    cwd: EXTENSION_ROOT,
    env: environment,
    stdio: "inherit",
  });
  execFileSync("bun", ["run", "zip:firefox"], {
    cwd: EXTENSION_ROOT,
    env: environment,
    stdio: "inherit",
  });
  const firefoxZip = readdirSync(join(EXTENSION_ROOT, ".output")).find((file) =>
    file.endsWith("-firefox.zip"),
  );
  if (!firefoxZip) {
    throw new Error("The Firefox extension archive was not created.");
  }
  return join(EXTENSION_ROOT, ".output", firefoxZip);
}

async function extensionPage(
  context: BrowserContext,
  browserType: typeof chromium | typeof firefox,
  firefoxPopupUrl?: string,
) {
  if (browserType === chromium) {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker", { timeout: 10_000 }));
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    return page;
  }
  if (!firefoxPopupUrl) {
    throw new Error("The Firefox Web Capture popup URL was not provided.");
  }
  const page = await context.newPage();
  await page.goto(firefoxPopupUrl);
  return page;
}

async function runExtensionJourney(
  browserType: typeof chromium | typeof firefox,
  extensionPath: string,
  fixtureUrl: string,
  firefoxPopupUrl?: string,
) {
  const userDataDirectory = mkdtempSync(
    join(tmpdir(), "cantiara-web-capture-"),
  );
  const context =
    browserType === chromium
      ? await chromium.launchPersistentContext(userDataDirectory, {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
          ],
          channel: "chromium",
          headless: false,
        })
      : await firefox.launchPersistentContext(userDataDirectory, {
          headless: true,
        });
  try {
    if (browserType === firefox) {
      // Playwright cannot load Firefox add-ons; run the built MV2 popup in
      // Firefox with only the WebExtension APIs needed by this journey.
      await context.addInitScript(
        ({ activeTabUrl }) => {
          const storage: Record<string, unknown> = {};
          const browserApi = {
            runtime: { id: "web-capture@cantiara.local" },
            scripting: {
              executeScript: () =>
                Promise.resolve([
                  { result: { selectedImageUrl: null, selectedText: "" } },
                ]),
            },
            storage: {
              local: {
                get: (key: string) => Promise.resolve({ [key]: storage[key] }),
                remove: (key: string) => {
                  delete storage[key];
                  return Promise.resolve();
                },
                set: (values: Record<string, unknown>) => {
                  Object.assign(storage, values);
                  return Promise.resolve();
                },
              },
            },
            tabs: {
              captureVisibleTab: () =>
                Promise.resolve("data:image/png;base64,AA=="),
              query: () =>
                Promise.resolve([
                  {
                    id: 1,
                    title: "Acceptance article",
                    url: activeTabUrl,
                    windowId: 1,
                  },
                ]),
            },
          };
          (globalThis as { browser?: typeof browserApi }).browser = browserApi;
        },
        { activeTabUrl: `${fixtureUrl}/page` },
      );
    }
    const sourcePage = await context.newPage();
    await sourcePage.goto(`${fixtureUrl}/page`);
    const popup = await extensionPage(context, browserType, firefoxPopupUrl);

    await popup.getByLabel("Pairing code").fill("CANTIARA-AB12-CD34");
    await popup.getByRole("button", { name: "Pair" }).click();
    await expect(
      popup.getByText("This browser is paired with Web Capture."),
    ).toBeVisible();

    await sourcePage.bringToFront();
    await popup
      .getByRole("button", { name: "Capture URL" })
      .dispatchEvent("click");
    await expect(popup.getByLabel("Target Inbox")).toHaveValue("workspace");
    await expect(popup.getByRole("button", { name: "Send" })).toBeEnabled();
    await popup.getByRole("button", { name: "Send" }).click();
    await expect(popup.getByRole("alert")).toContainText(
      "Capture could not be sent",
    );

    await popup.getByRole("button", { name: "Send" }).click();
    await expect(popup.getByRole("status")).toHaveText(
      "Sent to Capture Inbox.",
    );
  } finally {
    await context.close();
  }
}

test("captures through Web Capture in Chromium and Firefox without changing retry identity", async () => {
  test.setTimeout(120_000);
  const fixture = await startFixtureServer();
  const extensionServer = await startExtensionServer(FIREFOX_OUTPUT);
  try {
    const firefoxZip = buildExtension(fixture.url);
    await runExtensionJourney(chromium, CHROME_OUTPUT, fixture.url);
    fixture.resetSendAttempts();
    await runExtensionJourney(
      firefox,
      firefoxZip,
      fixture.url,
      extensionServer.popupUrl,
    );
    expect(fixture.requests).toHaveLength(4);
    expect(fixture.requests[0]?.authorization).toBe("Bearer extension-token");
    expect(fixture.requests[0]?.body.clientIdempotencyKey).toBe(
      fixture.requests[1]?.body.clientIdempotencyKey,
    );
    expect(fixture.requests[2]?.body.clientIdempotencyKey).toBe(
      fixture.requests[3]?.body.clientIdempotencyKey,
    );
  } finally {
    await fixture.close();
    await extensionServer.close();
  }
});
