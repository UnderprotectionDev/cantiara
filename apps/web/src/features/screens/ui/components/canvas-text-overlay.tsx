// biome-ignore-all lint/performance/noJsxPropsBind: The overlay binds to its own commit and cancel handlers.
import { useEffect, useRef } from "react";
import { WIREFRAME_FONT_FAMILY } from "../../engine/paint";

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
  const finished = useRef<boolean>(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);
  function commit(value: string) {
    if (!finished.current) {
      finished.current = true;
      onCommit(value);
    }
  }
  return (
    <textarea
      aria-label="Edit canvas text"
      className="absolute resize-none rounded border border-blue-500 bg-white px-1 text-sm text-slate-900 outline-none"
      defaultValue={initialValue}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finished.current = true;
          onCancel();
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit(event.currentTarget.value);
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
    />
  );
}
