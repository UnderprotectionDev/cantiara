// biome-ignore-all lint/performance/noJsxPropsBind: Each Moodboard card binds its own form state and revision.
import {
  MOODBOARD_CAPTION_MAX_LENGTH,
  MOODBOARD_UI_LABELS,
  type Moodboard,
  type MoodboardItem,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import type { FormEvent } from "react";
import { useState } from "react";

import { mutationErrorMessage } from "@/lib/mutation-messages";

import { useMoodboards } from "../../hooks/use-moodboards";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

function captionOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function VisualRow({
  api,
  item,
  moodboard,
}: {
  api: MoodboardsApi;
  item: MoodboardItem;
  moodboard: Moodboard;
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

function MoodboardCard({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  return (
    <article
      aria-label={moodboard.title}
      className="space-y-3 rounded-lg border p-4"
      id={`moodboard-${moodboard.id}`}
    >
      <h3 className="font-medium">{moodboard.title}</h3>
      <ul className="space-y-2">
        {moodboard.items.map((item) => (
          <VisualRow
            api={api}
            item={item}
            key={`${item.id}:${item.updatedAt}`}
            moodboard={moodboard}
          />
        ))}
      </ul>
      <AddVisualForm api={api} moodboard={moodboard} />
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
  const failure = [api.createMoodboard, api.addVisual, api.updateCaption].find(
    (mutation) => mutation.isError,
  )?.error;

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
