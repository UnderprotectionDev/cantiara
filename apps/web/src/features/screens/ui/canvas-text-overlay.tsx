// biome-ignore-all lint/performance/noJsxPropsBind: The overlay binds to its own commit and cancel handlers.
import { useEffect, useRef, useState } from "react";
import { WIREFRAME_FONT_FAMILY } from "../engine/paint";

/**
 * Transient DOM overlay for editing canvas text. Draft text lives here only
 * until Enter or blur; the result leaves as one `onCommit`, which the caller
 * turns into a WireframeDocument command. This is not a second text model.
 */
export function CanvasTextOverlay({
  bounds,
  initialValue,
  onCancel,
  onCommit,
}: {
  bounds: { height: number; width: number; x: number; y: number };
  initialValue: string;
  onCancel: () => void;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);
  return (
    <textarea
      aria-label="Edit canvas text"
      className="absolute resize-none rounded border border-blue-500 bg-white px-1 text-slate-900 text-sm outline-none"
      onBlur={() => onCommit(draft)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onCommit(draft);
        }
      }}
      ref={field}
      style={{
        fontFamily: `"${WIREFRAME_FONT_FAMILY}", sans-serif`,
        height: bounds.height,
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
      }}
      value={draft}
    />
  );
}
