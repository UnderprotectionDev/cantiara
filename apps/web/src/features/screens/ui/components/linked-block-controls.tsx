// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected block.
import type { LinkedBlockChangeResult } from "@cantiara/api/screens";
import {
  type WireframeBlock,
  type WireframeLinkedContent,
  type WireframeLinkedDefinition,
  wireframeLinkedContentSchema,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
import { useRef, useState } from "react";
import type { WireframeEditor } from "../../engine/editor";
import { LinkedSourceLabelForm } from "../forms/linked-source-label-form";

export interface LinkedBlockActions {
  apply: (
    definitionId: string,
    content: WireframeLinkedContent,
  ) => Promise<LinkedBlockChangeResult>;
  create: (
    name: string,
    content: WireframeLinkedContent,
  ) => Promise<WireframeLinkedDefinition>;
  preview: (
    definitionId: string,
    content: WireframeLinkedContent,
  ) => Promise<LinkedBlockChangeResult>;
}

/** Shared content of a block: everything but its placement and link. */
function linkedContentOf(block: WireframeBlock) {
  const { id: _id, link: _link, seed: _seed, x: _x, y: _y, ...content } = block;
  return wireframeLinkedContentSchema.safeParse(content);
}

export function AffectedScreensPreview({
  result,
}: {
  result: LinkedBlockChangeResult;
}) {
  if (result.affectedScreens.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">No Screens affected.</p>
    );
  }
  return (
    <div className="space-y-1 text-xs">
      <p>
        Affects {result.affectedScreens.length}{" "}
        {result.affectedScreens.length === 1 ? "Screen" : "Screens"}:
      </p>
      <ul aria-label="Affected Screens" className="list-disc pl-5">
        {result.affectedScreens.map((screen) => (
          <li key={screen.screenId}>
            {screen.title} ({screen.blockIds.length}{" "}
            {screen.blockIds.length === 1 ? "block" : "blocks"})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LinkedBlockControls({
  actions,
  block,
  editor,
  linkedBlock,
}: {
  actions?: LinkedBlockActions;
  /** The selected block with its definition applied. */
  block: WireframeBlock;
  editor: WireframeEditor;
  /** The selected block as stored (carries the link). */
  linkedBlock: WireframeBlock;
}) {
  const [preview, setPreview] = useState<LinkedBlockChangeResult>();
  const previewedLabel = useRef(block.label);
  const [error, setError] = useState<string>();
  const parsed = linkedContentOf(block);

  function detach() {
    setError(undefined);
    try {
      editor.dispatch([{ blockId: block.id, type: "detachLink" }]);
    } catch {
      setError("Link could not be detached.");
    }
  }

  async function run(action: () => Promise<void>) {
    setError(undefined);
    try {
      await action();
    } catch {
      setError("Linked block could not be updated.");
    }
  }

  function changedContent(label: string) {
    return parsed.success
      ? ({ ...parsed.data, label } satisfies WireframeLinkedContent)
      : null;
  }

  async function previewLabel(label: string) {
    if (!(actions && linkedBlock.link)) {
      return;
    }
    const { definitionId } = linkedBlock.link;
    await run(async () => {
      const content = changedContent(label);
      if (content) {
        setPreview(await actions.preview(definitionId, content));
        previewedLabel.current = label;
      }
    });
  }

  if (!linkedBlock.link) {
    if (!(actions && parsed.success)) {
      return null;
    }
    const content = parsed.data;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() =>
            run(async () => {
              const definition = await actions.create(block.label, content);
              editor.dispatch([
                { blockId: block.id, definition, type: "linkBlock" },
              ]);
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Create Linked Block
        </Button>
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const { definitionId } = linkedBlock.link;
  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      <p className="text-muted-foreground text-xs">
        Linked block: content comes from its source and is shared by every
        Screen that uses it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={detach} size="sm" type="button" variant="outline">
          Detach Link
        </Button>
        {actions ? (
          <LinkedSourceLabelForm
            initialLabel={block.label}
            onEdit={() => setPreview(undefined)}
            onPreview={previewLabel}
          />
        ) : null}
      </div>
      {preview && actions ? (
        <div className="space-y-2">
          <AffectedScreensPreview result={preview} />
          <Button
            onClick={() =>
              run(async () => {
                const content = changedContent(previewedLabel.current);
                if (!content) {
                  return;
                }
                const applied = await actions.apply(definitionId, content);
                editor.dispatch([
                  { definition: applied.definition, type: "applyLinkedSource" },
                ]);
                setPreview(undefined);
              })
            }
            size="sm"
            type="button"
          >
            Apply Change
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
