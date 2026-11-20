import type { FileAttachmentLocation } from "@cantiara/api/file-attachments";
import { useForm } from "@tanstack/react-form";
import { clampCoordinate } from "../lib/file-attachment-markup-geometry";

export type LocationKind = "point" | "region";

interface LocationFields {
  height: number;
  kind: LocationKind;
  page: number;
  width: number;
  x: number;
  y: number;
}

export function locationFields(
  location: FileAttachmentLocation,
): LocationFields {
  return {
    kind: location.kind,
    height: location.kind === "region" ? location.region.height : 0,
    page: location.page ?? 1,
    width: location.kind === "region" ? location.region.width : 0,
    x: location.kind === "point" ? location.x : location.region.x,
    y: location.kind === "point" ? location.y : location.region.y,
  };
}

export function locationFromFields(
  values: LocationFields,
  pageCount?: number,
): FileAttachmentLocation {
  const page = pageCount
    ? Math.max(1, Math.min(pageCount, Math.round(values.page) || 1))
    : undefined;
  const pageField = page === undefined ? {} : { page };
  const x = clampCoordinate(values.x);
  const y = clampCoordinate(values.y);
  if (values.kind === "point") {
    return { kind: values.kind, ...pageField, x, y };
  }
  return {
    kind: values.kind,
    ...pageField,
    region: {
      height: Math.min(1 - y, Math.max(0.001, clampCoordinate(values.height))),
      width: Math.min(1 - x, Math.max(0.001, clampCoordinate(values.width))),
      x,
      y,
    },
  };
}

export function useLocationFieldsForm(initial: FileAttachmentLocation) {
  return useForm({ defaultValues: locationFields(initial) });
}
