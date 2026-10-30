import { ExportError } from "@cantiara/api/data-export";
import { chromium } from "playwright";

import type { ExportPdfRenderer } from "./pdf-export-producer";

const PDF_TIMEOUT_MS = 15_000;

/**
 * Renders the snapshot page with the same Playwright/Chromium approach as the
 * single Document PDF: JavaScript off, every network request aborted. The
 * seam's capacity window already bounds how many renders run at once.
 */
export const renderExportPdf: ExportPdfRenderer = async (html) => {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: PDF_TIMEOUT_MS,
    });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(PDF_TIMEOUT_MS);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        page.pdf({
          format: "A4",
          landscape: true,
          margin: { bottom: "15mm", left: "10mm", right: "10mm", top: "15mm" },
          printBackground: true,
        }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new ExportError("limit_exceeded", "The PDF took too long."),
              ),
            PDF_TIMEOUT_MS,
          );
        }),
      ]);
      return output.toString("base64");
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await browser?.close();
  }
};
