// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The Konva double translates DOM events into measured stage coordinates.

import type { FileAttachmentMarkingTool } from "@cantiara/api/file-attachments";
import { act, type MouseEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { MarkupSurface } from "../file-attachment-markup";

vi.mock("react-konva", () => {
  interface StageEvent {
    target: {
      getStage: () => { getPointerPosition: () => { x: number; y: number } };
    };
  }
  function toStageEvent(event: MouseEvent) {
    return {
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: event.clientX, y: event.clientY }),
        }),
      },
    };
  }
  return {
    Arrow: () => null,
    Circle: () => null,
    Line: () => null,
    Rect: () => null,
    Layer: ({ children }: { children: ReactNode }) => children,
    Stage: ({
      children,
      height,
      onMouseDown,
      onMouseLeave,
      onMouseMove,
      onMouseUp,
      width,
    }: {
      children: ReactNode;
      height: number;
      onMouseDown: (event: StageEvent) => void;
      onMouseLeave: () => void;
      onMouseMove: (event: StageEvent) => void;
      onMouseUp: () => void;
      width: number;
    }) => (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: This element stands in for the canvas pointer adapter.
      // biome-ignore lint/a11y/noStaticElementInteractions: This element stands in for the canvas pointer adapter.
      <div
        data-stage-height={height}
        data-stage-width={width}
        onMouseDown={(event) => onMouseDown(toStageEvent(event))}
        onMouseLeave={onMouseLeave}
        onMouseMove={(event) => onMouseMove(toStageEvent(event))}
        onMouseUp={onMouseUp}
      >
        {children}
      </div>
    ),
  };
});

test("Markup clears an unfinished gesture when the tool, page, or file version changes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const create = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(
    tool: FileAttachmentMarkingTool,
    page: number,
    versionId: string,
  ) {
    act(() =>
      root.render(
        <MarkupSurface
          attachmentId="attachment-1"
          markings={[]}
          onCreateMarking={create}
          page={page}
          tool={tool}
          versionId={versionId}
        >
          <div>File preview</div>
        </MarkupSurface>,
      ),
    );
  }
  function pointer(type: string, coordinate: number) {
    const stage = host.querySelector("[data-stage-width]");
    expect(stage).not.toBeNull();
    act(() =>
      stage?.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: coordinate,
          clientY: coordinate,
        }),
      ),
    );
  }
  function draw() {
    pointer("mousedown", 100);
    pointer("mousemove", 200);
  }
  try {
    render("pen", 1, "version-1");
    draw();
    render("rectangle", 1, "version-1");
    pointer("mouseup", 200);
    draw();
    render("rectangle", 2, "version-1");
    pointer("mouseup", 200);
    draw();
    render("rectangle", 2, "version-2");
    pointer("mouseup", 200);
    await act(() => Promise.resolve());
    expect(create).not.toHaveBeenCalled();

    draw();
    pointer("mouseup", 200);
    await act(() => Promise.resolve());
    expect(create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        geometry: expect.objectContaining({ kind: "rectangle", page: 2 }),
        tool: "rectangle",
        versionId: "version-2",
      }),
    );
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
