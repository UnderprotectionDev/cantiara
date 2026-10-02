import {
  type DocumentSnapshot,
  DocumentTransferError,
} from "@cantiara/api/document-transfer";
import { renderHtml } from "@tanstack/markdown/html";
import { chromium } from "playwright";

let activeExports = 0;

export async function renderDocumentPdf(
  snapshot: DocumentSnapshot,
): Promise<string> {
  if (snapshot.markdown.length > 1_100_000) {
    throw new DocumentTransferError(
      "Document snapshot exceeds the PDF size limit.",
    );
  }
  if (activeExports >= 2) {
    throw new DocumentTransferError("PDF export is busy. Try again shortly.");
  }
  activeExports += 1;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const html = renderHtml(snapshot.markdown, { allowHtml: false });
    await page.setContent(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:12pt sans-serif;line-height:1.5;color:#111}pre{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{border-left:3px solid #ccc;padding-left:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}h1,h2,h3{break-after:avoid}img{display:none}</style></head><body>${html}</body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
        }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new DocumentTransferError("PDF export timed out.")),
            15_000,
          );
        }),
      ]);
      return output.toString("base64");
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      activeExports -= 1;
    }
  }
}
