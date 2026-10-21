// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the current presentation state.
import { Button } from "@cantiara/ui/components/button";
import { useEffect, useState } from "react";
import { linksOf } from "../../output/links";
import {
  activateBlock,
  type PresentationState,
  startPresentation,
} from "../../output/presentation";
import type { WireframeSnapshot } from "../../output/snapshot";
import { renderSvg } from "../../output/svg";

/**
 * Full-screen, read-only prototype over exact Wireframe versions. It renders
 * the export SVG (no editor, toolbar, inspector or Konva Stage) and only keeps
 * a view state in memory: it never opens editing and never calls a write.
 */
export function PresentationMode({
  fontDataUri,
  onExit,
  snapshots,
  startScreenId,
}: {
  fontDataUri?: string;
  onExit: () => void;
  snapshots: readonly WireframeSnapshot[];
  startScreenId: string;
}) {
  const [state, setState] = useState<PresentationState | null>(() =>
    startPresentation(snapshots, startScreenId),
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const current = snapshots.find((item) => item.screenId === state?.screenId);
  const links = current ? linksOf(current, snapshots) : [];
  const triggers = current
    ? current.document.blocks.filter(
        (block) =>
          links.some((link) => link.blockId === block.id) ||
          current.document.animations.some(
            (animation) =>
              animation.kind === "show-hide" &&
              animation.triggerBlockId === block.id,
          ),
      )
    : [];

  function activate(blockId: string) {
    setState((previous) =>
      previous ? activateBlock(snapshots, previous, blockId) : previous,
    );
  }

  return (
    <div
      aria-label="Presentation Mode"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-white"
      data-testid="presentation-mode"
      role="dialog"
    >
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <p className="text-sm">
          {current ? `${current.title} - Wireframe v${current.version}` : ""}
        </p>
        <Button onClick={onExit} size="sm" type="button" variant="outline">
          Exit Presentation Mode
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {current && state ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: Click delegation over the read-only SVG; the Prototype links list below is the keyboard path.
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Export SVG is escaped by the renderer.
            dangerouslySetInnerHTML={{
              __html: renderSvg(current, {
                fontDataUri,
                hiddenBlockIds: state.hiddenBlockIds,
              }).markup,
            }}
            onClick={(event) => {
              const block = (event.target as Element).closest?.(
                "[data-block-id]",
              );
              const id = block?.getAttribute("data-block-id");
              if (id) {
                activate(id);
              }
            }}
            onKeyDown={undefined}
            role="presentation"
          />
        ) : (
          <p role="alert">This Screen has no Wireframe version to present.</p>
        )}
      </div>
      <div className="space-y-2 border-t p-2">
        {state?.unresolvedTarget ? (
          <p className="text-destructive text-sm" role="status">
            Unresolved: {state.unresolvedTarget.targetScreenId}
          </p>
        ) : null}
        {triggers.length > 0 ? (
          <ul aria-label="Prototype links" className="flex flex-wrap gap-1">
            {triggers.map((block) => (
              <li key={block.id}>
                <Button
                  onClick={() => activate(block.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {block.label}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
