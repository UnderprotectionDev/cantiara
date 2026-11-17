import {
  buildInPublicSlugPreviewInputSchema,
  setBuildInPublicIndexingInputSchema,
  setBuildInPublicSlugInputSchema,
} from "@cantiara/api/build-in-public-publication";

/** A failed parse carries a message only when the API schema wrote one. */
type Parsed<T> = { data: T; ok: true } | { message?: string; ok: false };

const slugSchema = buildInPublicSlugPreviewInputSchema.shape.slug;
const setSlugSchema = setBuildInPublicSlugInputSchema.pick({
  confirmRedirect: true,
  slug: true,
});
/** The slug schema's own copy (format, reserved word); never Zod's default text. */
function slugMessage(issues: readonly { code: string; message: string }[]) {
  return issues.find(
    (issue) => issue.code === "invalid_format" || issue.code === "custom",
  )?.message;
}

const enableIndexingSchema = setBuildInPublicIndexingInputSchema.pick({
  acknowledgeThirdPartyCopies: true,
  enabled: true,
});

/** Preview slug change: the slug rules are the procedure's own (reserved words included). */
export function parseSlugForPreview(slug: string): Parsed<string> {
  const result = slugSchema.safeParse(slug);
  return result.success
    ? { data: result.data, ok: true }
    : { message: slugMessage(result.error.issues), ok: false };
}

/** Change slug: the redirect confirmation is a separate field, never implied. */
export function parseSetSlug(values: {
  confirmRedirect: boolean;
  slug: string;
}): Parsed<{ confirmRedirect: boolean; slug: string }> {
  const result = setSlugSchema.safeParse(values);
  return result.success
    ? { data: result.data, ok: true }
    : { message: slugMessage(result.error.issues), ok: false };
}

/**
 * `Enable indexing` needs the acknowledgement of third-party copies. The
 * control stays disabled until it is given, so a failure here has no copy.
 */
export function parseEnableIndexing(values: {
  acknowledged: boolean;
}): Parsed<{ acknowledgeThirdPartyCopies: boolean; enabled: boolean }> {
  const result = enableIndexingSchema.safeParse({
    acknowledgeThirdPartyCopies: values.acknowledged,
    enabled: true,
  });
  if (!(result.success && result.data.acknowledgeThirdPartyCopies)) {
    return { ok: false };
  }
  return { data: result.data, ok: true };
}
