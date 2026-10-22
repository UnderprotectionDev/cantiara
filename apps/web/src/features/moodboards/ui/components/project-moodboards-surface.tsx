// biome-ignore-all lint/performance/noJsxPropsBind: Each Moodboard card binds its own form state and revision.

import type { OutlineSourceTarget } from "@cantiara/api/moodboard-outline";
import {
  type ColorSwatch,
  MOODBOARD_UI_LABELS,
  type Moodboard,
  type MoodboardVisual,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";

import { isTauriRuntime } from "@/features/account-access/lib/tauri-session";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import { useMoodboards } from "../../hooks/use-moodboards";
import { sampleVisualColor } from "../../lib/color-sampling";
import { AddColorSwatchForm } from "../forms/add-color-swatch-form";
import { AddPaletteGroupForm } from "../forms/add-palette-group-form";
import { AddVisualForm } from "../forms/add-visual-form";
import { CreateMoodboardForm } from "../forms/create-moodboard-form";
import { VisualCaptionForm } from "../forms/visual-caption-form";
import {
  FocusOrderEditor,
  PresentationView,
  PresentedVisual,
  SnapshotPanel,
  VisualViewTools,
} from "./moodboard-view-tools";
import { MoodboardWorkspace } from "./moodboard-workspace";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

function VisualRow({
  api,
  item,
  moodboard,
  onSample,
}: {
  api: MoodboardsApi;
  item: MoodboardVisual;
  moodboard: Moodboard;
  onSample: ((hex: string) => void) | null;
}) {
  return (
    <li
      className="space-y-2 rounded-md border p-3"
      id={`moodboard-visual-${item.id}`}
      tabIndex={-1}
    >
      <p className="text-sm">
        {item.origin.kind === "External link" ? (
          <>
            <span className="font-medium">
              {MOODBOARD_UI_LABELS.externalLink}
            </span>
            {": "}
            <a
              className="underline"
              href={item.origin.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {item.origin.url}
            </a>
          </>
        ) : (
          <>
            <span className="font-medium">
              {MOODBOARD_UI_LABELS.fileAttachmentVersion}
            </span>
            {": "}
            <code>{item.origin.attachmentVersionId}</code>
          </>
        )}
      </p>
      {item.origin.kind === "External link" ? (
        <button
          aria-label={`${MOODBOARD_UI_LABELS.eyedrop}: ${item.caption ?? item.origin.url}`}
          className="block"
          disabled={onSample === null}
          onClick={(event) => {
            const image = event.currentTarget.querySelector("img");
            const hex = image
              ? sampleVisualColor(image, event.clientX, event.clientY)
              : null;
            if (hex) {
              onSample?.(hex);
            }
          }}
          type="button"
        >
          {/* biome-ignore lint/correctness/useImageSize: The natural size of a founder-provided link is unknown; max height bounds it. */}
          <img
            alt=""
            className={`max-h-40 rounded-md ${onSample ? "cursor-crosshair" : ""}`}
            crossOrigin="anonymous"
            src={item.origin.url}
          />
        </button>
      ) : null}
      {item.origin.kind === "External link" &&
      (item.view.crop !== null || item.view.rotation !== 0) ? (
        <PresentedVisual
          caption={item.caption}
          url={item.origin.url}
          view={item.view}
        />
      ) : null}
      <VisualViewTools api={api} item={item} moodboard={moodboard} />
      <VisualCaptionForm api={api} item={item} moodboard={moodboard} />
    </li>
  );
}

function SwatchRow({
  api,
  moodboard,
  swatch,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
  swatch: ColorSwatch;
}) {
  const selectId = `moodboard-swatch-group-${swatch.id}`;
  return (
    <li
      aria-label={`${MOODBOARD_UI_LABELS.colorSwatch} ${swatch.color}`}
      className="flex items-center gap-3 rounded-md border p-3"
    >
      <span
        aria-hidden="true"
        className="size-8 shrink-0 rounded border"
        style={{ backgroundColor: swatch.color }}
      />
      <div className="flex-1">
        <p className="font-mono text-sm">{swatch.color}</p>
        {swatch.note ? (
          <p className="text-muted-foreground text-sm">{swatch.note}</p>
        ) : null}
      </div>
      <Label className="sr-only" htmlFor={selectId}>
        {MOODBOARD_UI_LABELS.paletteGroup}
      </Label>
      <NativeSelect
        disabled={api.assignPaletteGroup.isPending}
        id={selectId}
        onChange={(event) =>
          api.assignPaletteGroup.mutate({
            itemId: swatch.id,
            moodboard,
            paletteGroupId: event.target.value || null,
          })
        }
        size="sm"
        value={swatch.paletteGroupId ?? ""}
      >
        <NativeSelectOption value="">
          {MOODBOARD_UI_LABELS.noPaletteGroup}
        </NativeSelectOption>
        {moodboard.paletteGroups.map((group) => (
          <NativeSelectOption key={group.id} value={group.id}>
            {group.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </li>
  );
}

function MoodboardCard({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const [sampleTarget, setSampleTarget] = useState<
    ((hex: string) => void) | null
  >(null);
  const [presenting, setPresenting] = useState(false);
  const visuals = moodboard.items.filter(
    (item): item is MoodboardVisual => item.kind === "Visual",
  );
  const swatches = moodboard.items.filter(
    (item): item is ColorSwatch => item.kind === "Color Swatch",
  );
  const swatchSections = [
    ...moodboard.paletteGroups.map((group) => ({
      id: group.id,
      name: group.name,
      swatches: swatches.filter(
        ({ paletteGroupId }) => paletteGroupId === group.id,
      ),
    })),
    {
      id: "",
      name: MOODBOARD_UI_LABELS.noPaletteGroup,
      swatches: swatches.filter(
        ({ paletteGroupId }) => paletteGroupId === null,
      ),
    },
  ].filter(({ id, swatches: members }) => id !== "" || members.length > 0);
  function openSource(target: OutlineSourceTarget, itemId: string) {
    if (target.kind === "link") {
      if (isTauriRuntime()) {
        import("@tauri-apps/plugin-opener")
          .then(({ openUrl }) => openUrl(target.url))
          .catch(() => undefined);
        return;
      }
      window.open(target.url, "_blank", "noopener,noreferrer");
      return;
    }
    // A File Attachment version opens in context: its row shows the exact version.
    const row = document.getElementById(`moodboard-visual-${itemId}`);
    row?.scrollIntoView?.({ block: "center" });
    row?.focus();
  }
  if (presenting) {
    return (
      <article
        aria-label={moodboard.title}
        className="space-y-3 rounded-lg border p-4"
        id={`moodboard-${moodboard.id}`}
      >
        <h3 className="font-medium">{moodboard.title}</h3>
        <PresentationView
          moodboard={moodboard}
          onExit={() => setPresenting(false)}
        />
      </article>
    );
  }
  return (
    <article
      aria-label={moodboard.title}
      className="space-y-3 rounded-lg border p-4"
      id={`moodboard-${moodboard.id}`}
    >
      <h3 className="font-medium">{moodboard.title}</h3>
      <Button
        onClick={() => setPresenting(true)}
        type="button"
        variant="outline"
      >
        {MOODBOARD_UI_LABELS.presentationMode}
      </Button>
      <ul className="space-y-2">
        {visuals.map((item) => (
          <VisualRow
            api={api}
            item={item}
            key={`${item.id}:${item.updatedAt}`}
            moodboard={moodboard}
            onSample={sampleTarget}
          />
        ))}
      </ul>
      <MoodboardWorkspace
        addControls={
          <div className="space-y-3">
            <AddVisualForm api={api} moodboard={moodboard} />
            <AddColorSwatchForm
              api={api}
              moodboard={moodboard}
              onStartSampling={(apply) => setSampleTarget(() => apply)}
            />
          </div>
        }
        api={api}
        moodboard={moodboard}
        onOpenSource={openSource}
      />
      <section
        aria-label={MOODBOARD_UI_LABELS.colorSwatch}
        className="space-y-3"
      >
        <h4 className="font-medium">{MOODBOARD_UI_LABELS.colorSwatch}</h4>
        {swatchSections.map((section) => (
          <fieldset className="space-y-2" key={section.id}>
            <legend className="text-muted-foreground text-sm">
              {MOODBOARD_UI_LABELS.paletteGroup}: {section.name}
            </legend>
            <ul className="space-y-2">
              {section.swatches.map((swatch) => (
                <SwatchRow
                  api={api}
                  key={`${swatch.id}:${swatch.updatedAt}`}
                  moodboard={moodboard}
                  swatch={swatch}
                />
              ))}
            </ul>
          </fieldset>
        ))}
        <AddPaletteGroupForm api={api} moodboard={moodboard} />
      </section>
      <FocusOrderEditor api={api} moodboard={moodboard} />
      <SnapshotPanel api={api} moodboard={moodboard} />
    </article>
  );
}

export default function ProjectMoodboardsSurface({
  projectId,
  selectedMoodboardId,
}: {
  projectId: string;
  selectedMoodboardId?: string;
}) {
  const api = useMoodboards(projectId);
  const { moodboardsQuery } = api;
  const moodboards = (moodboardsQuery.data ?? []).filter(
    ({ id }) => !selectedMoodboardId || id === selectedMoodboardId,
  );
  const failure = [
    api.createMoodboard,
    api.addVisual,
    api.updateCaption,
    api.addColorSwatch,
    api.addPaletteGroup,
    api.assignPaletteGroup,
    api.setVisualView,
    api.setFocusOrder,
    api.reorderItems,
  ].find((mutation) => mutation.isError)?.error;

  return (
    <section
      aria-label={MOODBOARD_UI_LABELS.moodboard}
      className="space-y-5"
      id="moodboards"
    >
      <h2 className="font-semibold text-2xl">
        {MOODBOARD_UI_LABELS.moodboard}
      </h2>
      <CreateMoodboardForm api={api} projectId={projectId} />
      {moodboardsQuery.isError ? (
        <p role="alert">{MOODBOARD_UI_LABELS.moodboard} is unavailable.</p>
      ) : null}
      {failure ? (
        <p role="alert">
          {mutationErrorMessage(failure, "Moodboard could not be saved.")}
        </p>
      ) : null}
      {moodboardsQuery.isSuccess && moodboards.length === 0 ? (
        <p className="text-muted-foreground">
          {MOODBOARD_UI_LABELS.noMoodboards}
        </p>
      ) : null}
      {moodboards.map((moodboard) => (
        <MoodboardCard api={api} key={moodboard.id} moodboard={moodboard} />
      ))}
    </section>
  );
}
