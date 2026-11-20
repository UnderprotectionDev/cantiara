// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected block.
import type { LinkedBlockChangeResult } from "@cantiara/api/screens";
import {
  type WireframeBlock,
  type WireframeLinkedContent,
  type WireframeLinkedDefinition,
  wireframeLinkedContentSchema,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
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
      <p className="text-xs text-muted-foreground">No Screens affected.</p>
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

interface LinkedBlockControlsProps {
  actions?: LinkedBlockActions;
  block: WireframeBlock;
  editor: WireframeEditor;
  linkedBlock: WireframeBlock;
}

export function LinkedBlockControls(props: LinkedBlockControlsProps) {
  if (!props.actions) {
    return props.linkedBlock.link ? (
      <DetachLinkedBlock block={props.block} editor={props.editor} />
    ) : null;
  }
  return <LinkedBlockWrites {...props} actions={props.actions} />;
}

function DetachLinkedBlock({
  block,
  editor,
}: Pick<LinkedBlockControlsProps, "block" | "editor">) {
  const [error, setError] = useState(false);
  function detach() {
    try {
      editor.dispatch([{ blockId: block.id, type: "detachLink" }]);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <>
      <Button onClick={detach} size="sm" type="button" variant="outline">
        Detach Link
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          Link could not be detached.
        </p>
      ) : null}
    </>
  );
}

function LinkedBlockWrites({
  actions,
  block,
  editor,
  linkedBlock,
}: LinkedBlockControlsProps & { actions: LinkedBlockActions }) {
  const inspect = useMutation({
    mutationKey: orpc.previewLinkedBlockChange.mutationKey(),
    mutationFn: ({
      definitionId: sourceId,
      content,
    }: {
      definitionId: string;
      content: WireframeLinkedContent;
    }) => actions.preview(sourceId, content),
    meta: { retryInSurface: true },
  });
  const [error, setError] = useState<string>();
  const parsed = linkedContentOf(block);

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
    setError(undefined);
    const content = changedContent(label);
    if (content) {
      await inspect
        .mutateAsync({ definitionId, content })
        .catch(() => undefined);
    }
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
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const { definitionId } = linkedBlock.link;
  const shownError = inspect.isError
    ? "Linked block preview is unavailable."
    : error;
  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">
        Linked block: content comes from its source and is shared by every
        Screen that uses it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <DetachLinkedBlock block={block} editor={editor} />
        {actions ? (
          <LinkedSourceLabelForm
            initialLabel={block.label}
            onEdit={inspect.reset}
            onPreview={previewLabel}
          />
        ) : null}
      </div>
      {inspect.data && inspect.variables ? (
        <div className="space-y-2">
          <AffectedScreensPreview result={inspect.data} />
          <Button
            onClick={() =>
              run(async () => {
                const content = inspect.variables?.content;
                if (!content) {
                  return;
                }
                const applied = await actions.apply(definitionId, content);
                editor.dispatch([
                  { definition: applied.definition, type: "applyLinkedSource" },
                ]);
                inspect.reset();
              })
            }
            size="sm"
            type="button"
          >
            Apply Change
          </Button>
        </div>
      ) : null}
      {shownError ? (
        <p className="text-xs text-destructive" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
