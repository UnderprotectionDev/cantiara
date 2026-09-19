import { toast } from "sonner";

import {
  type BuildSupportReferenceFailureOptions,
  buildSupportReferenceFailure,
  type SupportReferenceFailure,
} from "../../lib/support-reference";

export interface PresentSupportReferenceFailureOptions
  extends BuildSupportReferenceFailureOptions {
  retry?: () => Promise<unknown> | unknown;
}

export function presentSupportReferenceFailure(
  error: unknown,
  options: PresentSupportReferenceFailureOptions,
) {
  const failure = buildSupportReferenceFailure(error, options);
  toast.error(failure.reason, {
    action:
      failure.canRetry && options.retry
        ? {
            label: "Retry",
            onClick: () => {
              Promise.resolve(options.retry?.()).catch(() => undefined);
            },
          }
        : undefined,
    description: <SupportReferenceNotice failure={failure} />,
    duration: failure.duration,
  });
  return failure;
}

export function SupportReferenceNotice({
  failure,
}: {
  failure: SupportReferenceFailure;
}) {
  return (
    <div aria-live="polite" className="space-y-1 text-sm" role="alert">
      <p>{failure.writeOutcomeLabel}</p>
      <p>{failure.retryBound}</p>
      <p>
        {failure.supportReference ? (
          <>
            <span>Support reference</span>{" "}
            <code>{failure.supportReference}</code>
          </>
        ) : (
          "Support reference unavailable."
        )}
      </p>
    </div>
  );
}
