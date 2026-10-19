import type { RenderedSvg } from "./svg";

/** Browser-only delivery of an already rendered export; nothing here reads or writes the product. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, type: string, filename: string) {
  downloadBlob(new Blob([text], { type }), filename);
}

const PNG_SCALE = 2;

/** Rasterises the export SVG (not a Konva Stage) to PNG. */
export async function svgToPngBlob(svg: RenderedSvg): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg.markup], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(svg.width * PNG_SCALE);
    canvas.height = Math.ceil(svg.height * PNG_SCALE);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("PNG export is unavailable.");
    }
    context.scale(PNG_SCALE, PNG_SCALE);
    context.drawImage(image, 0, 0, svg.width, svg.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG failed."))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PDF: the browser prints the export print document to PDF in an isolated frame. */
export function printToPdf(printDocument: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  frame.style.cssText =
    "position:fixed;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = printDocument;
  frame.addEventListener("load", () => {
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  });
  document.body.append(frame);
}
