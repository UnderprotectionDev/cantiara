// biome-ignore-all lint/performance/noJsxPropsBind: Slug controls bind to their form values.
import type {
  BuildInPublicPublication,
  BuildInPublicSlugPreview,
} from "@cantiara/api/build-in-public-publication";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import {
  parseSetSlug,
  parseSlugForPreview,
} from "../../lib/build-in-public-publication-form";

export function BuildInPublicSlugForm({
  onPreviewSlug,
  onSetSlug,
  publication,
  slugPreview,
}: {
  onPreviewSlug: (slug: string) => void;
  onSetSlug: (input: {
    confirmRedirect: boolean;
    slug: string;
  }) => Promise<unknown>;
  publication: BuildInPublicPublication;
  slugPreview: BuildInPublicSlugPreview | null;
}) {
  const [slugError, setSlugError] = useState<string>();
  const slugForm = useForm({
    defaultValues: { confirmRedirect: false, slug: publication.slug ?? "" },
    onSubmit: async ({ value }) => {
      setSlugError(undefined);
      const parsed = parseSetSlug(value);
      if (!parsed.ok) {
        setSlugError(parsed.message);
        return;
      }
      try {
        await onSetSlug(parsed.data);
      } catch {
        // The caller owns the write and its failure presentation; the typed
        // slug stays.
      }
    },
  });
  const slugValues = useStore(slugForm.store, (state) => state.values);
  const { confirmRedirect, slug } = slugValues;
  return (
    <form
      aria-label="Slug"
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        slugForm.handleSubmit().catch(() => undefined);
      }}
    >
      <label htmlFor="bip-slug">Slug</label>
      <slugForm.Field name="slug">
        {(field) => (
          <Input
            id="bip-slug"
            maxLength={80}
            name={field.name}
            onChange={(event) => {
              field.handleChange(event.target.value);
              slugForm.setFieldValue("confirmRedirect", false);
            }}
            value={field.state.value}
          />
        )}
      </slugForm.Field>
      <Button
        disabled={slug.trim() === ""}
        onClick={() => {
          const parsed = parseSlugForPreview(slug);
          if (!parsed.ok) {
            setSlugError(parsed.message);
            return;
          }
          setSlugError(undefined);
          onPreviewSlug(parsed.data);
        }}
        type="button"
        variant="outline"
      >
        Preview slug change
      </Button>
      {slugError ? <p role="alert">{slugError}</p> : null}
      {slugPreview?.available === false ? (
        <p role="alert">Another published surface already uses this slug.</p>
      ) : null}
      {slugPreview?.redirect ? (
        <div className="grid gap-2">
          <p>{`${slugPreview.redirect.from} will redirect to ${slugPreview.redirect.to} while this page is public. Unpublishing ends the redirect.`}</p>
          <div className="flex items-center gap-2">
            <slugForm.Field name="confirmRedirect">
              {(field) => (
                <Checkbox
                  checked={field.state.value}
                  id="bip-confirm-redirect"
                  onCheckedChange={(next) => field.handleChange(next === true)}
                />
              )}
            </slugForm.Field>
            <label htmlFor="bip-confirm-redirect">Confirm redirect</label>
          </div>
        </div>
      ) : null}
      <Button
        disabled={
          slug.trim() === "" ||
          !slugPreview ||
          slugPreview.slug !== slug ||
          !slugPreview.available ||
          (Boolean(slugPreview.redirect) && !confirmRedirect)
        }
        type="submit"
      >
        Change slug
      </Button>
    </form>
  );
}
