// biome-ignore-all lint/performance/noJsxPropsBind: Each Moodboard card binds its own form state and revision.
import { normalizeColorHex } from "@cantiara/api/moodboard-color";
import {
  type ColorSwatch,
  MOODBOARD_CAPTION_MAX_LENGTH,
  MOODBOARD_NOTE_MAX_LENGTH,
  MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH,
  MOODBOARD_UI_LABELS,
  type Moodboard,
  type MoodboardVisual,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import type { FormEvent } from "react";
import { useState } from "react";

import { mutationErrorMessage } from "@/lib/mutation-messages";
import { useMoodboards } from "../../hooks/use-moodboards";
import {
  isEyeDropperAvailable,
  pickColorWithEyeDropper,
  sampleVisualColor,
} from "../../lib/color-sampling";
import {
  FocusOrderEditor,
  PresentationView,
  PresentedVisual,
  SnapshotPanel,
  VisualViewTools,
} from "./moodboard-view-tools";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

function captionOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

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
  const [caption, setCaption] = useState(item.caption ?? "");
  const inputId = `moodboard-caption-${item.id}`;

  function saveCaption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    api.updateCaption.mutate({
      caption: captionOrNull(caption),
      itemId: item.id,
      moodboard,
    });
  }

  return (
    <li className="space-y-2 rounded-md border p-3">
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
      <form className="flex items-end gap-2" onSubmit={saveCaption}>
        <div className="flex-1 space-y-1">
          <Label htmlFor={inputId}>{MOODBOARD_UI_LABELS.caption}</Label>
          <Input
            id={inputId}
            maxLength={MOODBOARD_CAPTION_MAX_LENGTH}
            onChange={(event) => setCaption(event.target.value)}
            value={caption}
          />
        </div>
        <Button
          disabled={
            api.updateCaption.isPending ||
            captionOrNull(caption) === item.caption
          }
          type="submit"
          variant="outline"
        >
          Save
        </Button>
      </form>
    </li>
  );
}

function AddVisualForm({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const [originKind, setOriginKind] = useState<
    "External link" | "File Attachment version"
  >("External link");
  const [reference, setReference] = useState("");
  const [caption, setCaption] = useState("");
  const idPrefix = `moodboard-add-${moodboard.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = reference.trim();
    api.addVisual.mutate(
      {
        caption: captionOrNull(caption),
        moodboard,
        origin:
          originKind === "External link"
            ? { kind: "External link", url: value }
            : { attachmentVersionId: value, kind: "File Attachment version" },
      },
      {
        onSuccess: () => {
          setReference("");
          setCaption("");
        },
      },
    );
  }

  return (
    <form
      aria-label={MOODBOARD_UI_LABELS.addVisual}
      className="space-y-2"
      onSubmit={submit}
    >
      <fieldset className="flex gap-4">
        <legend className="sr-only">Origin</legend>
        {(["External link", "File Attachment version"] as const).map((kind) => (
          <label className="inline-flex items-center gap-1" key={kind}>
            <input
              checked={originKind === kind}
              name={`${idPrefix}-origin`}
              onChange={() => setOriginKind(kind)}
              type="radio"
            />
            {kind === "External link"
              ? MOODBOARD_UI_LABELS.externalLink
              : MOODBOARD_UI_LABELS.fileAttachmentVersion}
          </label>
        ))}
      </fieldset>
      <Label htmlFor={`${idPrefix}-reference`}>
        {originKind === "External link"
          ? MOODBOARD_UI_LABELS.externalLink
          : `${MOODBOARD_UI_LABELS.fileAttachmentVersion} ID`}
      </Label>
      <Input
        id={`${idPrefix}-reference`}
        onChange={(event) => setReference(event.target.value)}
        required
        value={reference}
      />
      <Label htmlFor={`${idPrefix}-caption`}>
        {MOODBOARD_UI_LABELS.caption}
      </Label>
      <Input
        id={`${idPrefix}-caption`}
        maxLength={MOODBOARD_CAPTION_MAX_LENGTH}
        onChange={(event) => setCaption(event.target.value)}
        value={caption}
      />
      <Button disabled={api.addVisual.isPending} type="submit">
        {MOODBOARD_UI_LABELS.addVisual}
      </Button>
    </form>
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
      <select
        className="rounded-md border bg-background px-2 py-1 text-sm"
        disabled={api.assignPaletteGroup.isPending}
        id={selectId}
        onChange={(event) =>
          api.assignPaletteGroup.mutate({
            itemId: swatch.id,
            moodboard,
            paletteGroupId: event.target.value || null,
          })
        }
        value={swatch.paletteGroupId ?? ""}
      >
        <option value="">{MOODBOARD_UI_LABELS.noPaletteGroup}</option>
        {moodboard.paletteGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </li>
  );
}

function AddColorSwatchForm({
  api,
  moodboard,
  onStartSampling,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
  onStartSampling: (apply: ((hex: string) => void) | null) => void;
}) {
  const [entry, setEntry] = useState("#808080");
  const [note, setNote] = useState("");
  const [paletteGroupId, setPaletteGroupId] = useState("");
  const idPrefix = `moodboard-swatch-${moodboard.id}`;
  const normalized = normalizeColorHex(entry);

  async function pickFromVisual() {
    if (isEyeDropperAvailable()) {
      const hex = await pickColorWithEyeDropper();
      if (hex) {
        setEntry(hex);
      }
      return;
    }
    onStartSampling((hex) => {
      setEntry(hex);
      onStartSampling(null);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalized) {
      return;
    }
    api.addColorSwatch.mutate(
      {
        color: normalized,
        moodboard,
        note: captionOrNull(note),
        paletteGroupId: paletteGroupId || null,
      },
      { onSuccess: () => setNote("") },
    );
  }

  return (
    <form
      aria-label={MOODBOARD_UI_LABELS.addColorSwatch}
      className="space-y-2"
      onSubmit={submit}
    >
      <div className="flex items-end gap-2">
        <input
          aria-label="Picker"
          className="h-9 w-12 rounded border"
          onChange={(event) => setEntry(event.target.value)}
          type="color"
          value={normalized?.toLowerCase() ?? "#808080"}
        />
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${idPrefix}-color`}>
            {MOODBOARD_UI_LABELS.color} (
            {MOODBOARD_UI_LABELS.colorSwatchEntryHint})
          </Label>
          <Input
            aria-invalid={normalized === null}
            id={`${idPrefix}-color`}
            onChange={(event) => setEntry(event.target.value)}
            value={entry}
          />
        </div>
        <Button onClick={pickFromVisual} type="button" variant="outline">
          {MOODBOARD_UI_LABELS.eyedrop}
        </Button>
      </div>
      <Label htmlFor={`${idPrefix}-note`}>{MOODBOARD_UI_LABELS.note}</Label>
      <Input
        id={`${idPrefix}-note`}
        maxLength={MOODBOARD_NOTE_MAX_LENGTH}
        onChange={(event) => setNote(event.target.value)}
        value={note}
      />
      <Label htmlFor={`${idPrefix}-group`}>
        {MOODBOARD_UI_LABELS.paletteGroup}
      </Label>
      <select
        className="block rounded-md border bg-background px-2 py-1"
        id={`${idPrefix}-group`}
        onChange={(event) => setPaletteGroupId(event.target.value)}
        value={paletteGroupId}
      >
        <option value="">{MOODBOARD_UI_LABELS.noPaletteGroup}</option>
        {moodboard.paletteGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <Button
        disabled={api.addColorSwatch.isPending || normalized === null}
        type="submit"
      >
        {MOODBOARD_UI_LABELS.addColorSwatch}
      </Button>
    </form>
  );
}

function AddPaletteGroupForm({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const [name, setName] = useState("");
  const inputId = `moodboard-group-${moodboard.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    api.addPaletteGroup.mutate(
      { moodboard, name },
      { onSuccess: () => setName("") },
    );
  }

  return (
    <form
      aria-label={MOODBOARD_UI_LABELS.addPaletteGroup}
      className="flex items-end gap-2"
      onSubmit={submit}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor={inputId}>{MOODBOARD_UI_LABELS.paletteGroup}</Label>
        <Input
          id={inputId}
          maxLength={MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <Button
        disabled={api.addPaletteGroup.isPending}
        type="submit"
        variant="outline"
      >
        {MOODBOARD_UI_LABELS.addPaletteGroup}
      </Button>
    </form>
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
      <AddVisualForm api={api} moodboard={moodboard} />
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
        <AddColorSwatchForm
          api={api}
          moodboard={moodboard}
          onStartSampling={(apply) => setSampleTarget(() => apply)}
        />
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
  const [title, setTitle] = useState("");
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
  ].find((mutation) => mutation.isError)?.error;

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    api.createMoodboard.mutate({ title }, { onSuccess: () => setTitle("") });
  }

  return (
    <section
      aria-label={MOODBOARD_UI_LABELS.moodboard}
      className="space-y-5"
      id="moodboards"
    >
      <h2 className="font-semibold text-2xl">
        {MOODBOARD_UI_LABELS.moodboard}
      </h2>
      <form className="flex items-end gap-2" onSubmit={create}>
        <div className="flex-1 space-y-1">
          <Label htmlFor="moodboard-title">{MOODBOARD_UI_LABELS.title}</Label>
          <Input
            id="moodboard-title"
            maxLength={255}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <Button disabled={api.createMoodboard.isPending} type="submit">
          {MOODBOARD_UI_LABELS.createMoodboard}
        </Button>
      </form>
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
