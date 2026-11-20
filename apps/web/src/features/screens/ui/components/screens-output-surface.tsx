// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the loaded Screens.

import type { ScreenRecord } from "@cantiara/api/screens";
import fontDataUri from "@fontsource/shantell-sans/files/shantell-sans-latin-400-normal.woff2?inline";
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import type { ChosenVersion, ExportFormat } from "../../lib/screens-output";
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
import { ScreensOutputPanel } from "../forms/screens-output-form";
import { PresentationMode } from "./presentation-mode";

/**
 * Reads exact Wireframe versions (read-only queries with an explicit version
 * number) and hands them to the export renderers or Presentation Mode. No
 * write procedure is called from here.
 */
async function loadSnapshots(
  queryClient: QueryClient,
  projectId: string,
  screens: ScreenRecord[],
  chosen: ChosenVersion[],
): Promise<WireframeSnapshot[]> {
  return await Promise.all(
    chosen.map(async ({ screenId, version }) => {
      const screen = screens.find(({ id }) => id === screenId);
      const stored = await queryClient.query(
        orpc.screenWireframe.queryOptions({
          input: { projectId, screenId, version },
        }),
      );
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
  const queryClient = useQueryClient();
  const [presenting, setPresenting] = useState(false);
  const output = useMutation({
    meta: { retryInSurface: true },
    mutationFn: async (
      request: { chosen: ChosenVersion[] } & (
        | { format: ExportFormat }
        | { startScreenId: string }
      ),
    ) => {
      const snapshots = await loadSnapshots(
        queryClient,
        projectId,
        screens,
        request.chosen,
      );
      if ("format" in request) {
        await exportAs(request.format, snapshots);
        return null;
      }
      return { snapshots, startScreenId: request.startScreenId };
    },
  });

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
        busy={output.isPending}
        error={
          output.isError
            ? "Wireframe versions could not be read. Try again."
            : undefined
        }
        onExport={(format, chosen) => output.mutate({ chosen, format })}
        onPresent={(chosen, startScreenId) =>
          output.mutate(
            { chosen, startScreenId },
            { onSuccess: () => setPresenting(true) },
          )
        }
        screens={screens}
      />
      {presenting && output.data ? (
        <PresentationMode
          fontDataUri={fontDataUri}
          onExit={() => setPresenting(false)}
          snapshots={output.data.snapshots}
          startScreenId={output.data.startScreenId}
        />
      ) : null}
    </>
  );
}
