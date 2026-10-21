// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the loaded Screens.

import type { ScreenRecord } from "@cantiara/api/screens";
import fontDataUri from "@fontsource/shantell-sans/files/shantell-sans-latin-400-normal.woff2?inline";
import { useState } from "react";
import { client } from "@/utils/orpc";
import {
  downloadBlob,
  downloadText,
  printToPdf,
  svgToPngBlob,
} from "../../output/download";
import { renderInteractiveHtml } from "../../output/html";
import { renderPrintDocument } from "../../output/print";
import {
  createWireframeSnapshot,
  type WireframeSnapshot,
} from "../../output/snapshot";
import { renderSvg } from "../../output/svg";
import { PresentationMode } from "./presentation-mode";
import {
  type ChosenVersion,
  type ExportFormat,
  ScreensOutputPanel,
} from "./screens-output-panel";

/**
 * Reads exact Wireframe versions (read-only queries with an explicit version
 * number) and hands them to the export renderers or Presentation Mode. No
 * write procedure is called from here.
 */
async function loadSnapshots(
  projectId: string,
  screens: ScreenRecord[],
  chosen: ChosenVersion[],
): Promise<WireframeSnapshot[]> {
  return await Promise.all(
    chosen.map(async ({ screenId, version }) => {
      const screen = screens.find(({ id }) => id === screenId);
      const stored = await client.screenWireframe({
        projectId,
        screenId,
        version,
      });
      return createWireframeSnapshot({
        document: stored.document,
        latestVersion: Math.max(
          ...(screen?.wireframeVersions.map((item) => item.version) ?? [1]),
        ),
        screenId,
        title: screen?.title ?? screenId,
        version: stored.version,
      });
    }),
  );
}

function fileName(snapshot: WireframeSnapshot, extension: string) {
  const slug = snapshot.title.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${slug || "screen"}-v${snapshot.version}.${extension}`;
}

export default function ScreensOutputSurface({
  projectId,
  screens,
}: {
  projectId: string;
  screens: ScreenRecord[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [presenting, setPresenting] = useState<{
    snapshots: WireframeSnapshot[];
    startScreenId: string;
  } | null>(null);

  async function run(
    chosen: ChosenVersion[],
    action: (s: WireframeSnapshot[]) => Promise<void> | void,
  ) {
    setBusy(true);
    setError(undefined);
    try {
      await action(await loadSnapshots(projectId, screens, chosen));
    } catch {
      setError("Wireframe versions could not be read. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function exportAs(
    format: ExportFormat,
    snapshots: WireframeSnapshot[],
  ) {
    switch (format) {
      case "HTML":
        downloadText(
          renderInteractiveHtml(snapshots, { fontDataUri }),
          "text/html",
          "wireframe-export.html",
        );
        return;
      case "PDF":
        printToPdf(renderPrintDocument(snapshots, { fontDataUri }));
        return;
      case "SVG":
        for (const snapshot of snapshots) {
          downloadText(
            renderSvg(snapshot, { fontDataUri, standalone: true }).markup,
            "image/svg+xml",
            fileName(snapshot, "svg"),
          );
        }
        return;
      default:
        await Promise.all(
          snapshots.map(async (snapshot) =>
            downloadBlob(
              await svgToPngBlob(
                renderSvg(snapshot, { fontDataUri, standalone: true }),
              ),
              fileName(snapshot, "png"),
            ),
          ),
        );
    }
  }

  return (
    <>
      <ScreensOutputPanel
        busy={busy}
        error={error}
        onExport={(format, chosen) =>
          run(chosen, (snapshots) => exportAs(format, snapshots))
        }
        onPresent={(chosen, startScreenId) =>
          run(chosen, (snapshots) =>
            setPresenting({ snapshots, startScreenId }),
          )
        }
        screens={screens}
      />
      {presenting ? (
        <PresentationMode
          fontDataUri={fontDataUri}
          onExit={() => setPresenting(null)}
          snapshots={presenting.snapshots}
          startScreenId={presenting.startScreenId}
        />
      ) : null}
    </>
  );
}
