// biome-ignore-all lint/performance/noJsxPropsBind: The handlers bind to this surface.

import { SHARE_TOKEN_LABEL } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";
import { writeTextToClipboard } from "@/lib/clipboard";
import type { ShareRotationFeedback } from "../../hooks/use-share-access";
import { linkSharingRefusalMessage } from "../../lib/link-sharing-refusal";
import { shareVisitorUrl } from "../../lib/share-access";
import { SharePasswordForm } from "../forms/share-password-form";

/**
 * Owner-only access controls of one Dış yüzey: the visitor link, shown once
 * because only its hash is stored, and the optional Link password. Rotating
 * the link or changing the password ends every open visit.
 */
export function ShareAccessPanel({
  issuedToken,
  onRemovePassword,
  onRotate,
  onSavePassword,
  passwordProtected,
  rotation,
  serverUrl,
}: {
  issuedToken: string | null;
  onRemovePassword: () => Promise<unknown>;
  onRotate: () => Promise<unknown>;
  onSavePassword: (password: string) => Promise<unknown>;
  passwordProtected: boolean;
  rotation: ShareRotationFeedback | null;
  serverUrl: string;
}) {
  const [copyOutcome, setCopyOutcome] = useState<"success" | "error" | null>(
    null,
  );
  const link = issuedToken ? shareVisitorUrl(serverUrl, issuedToken) : null;
  const rotateStatus =
    !copyOutcome && rotation?.status === "success"
      ? "New link created. The old link and every open visit ended."
      : null;
  const status = copyOutcome === "success" ? "Link copied." : rotateStatus;
  const rotationError = !copyOutcome && rotation?.status === "error";
  const error =
    copyOutcome === "error" || rotationError
      ? ((rotationError ? linkSharingRefusalMessage(rotation.error) : null) ??
        "That did not work. Try again.")
      : null;

  async function copy() {
    if (!link) {
      return;
    }
    setCopyOutcome(null);
    try {
      await writeTextToClipboard(link);
      setCopyOutcome("success");
    } catch {
      setCopyOutcome("error");
    }
  }
  function rotate() {
    setCopyOutcome(null);
    onRotate().catch(() => undefined);
  }
  return (
    <section aria-label="Link access" className="space-y-4">
      <h4 className="text-sm font-medium">{SHARE_TOKEN_LABEL}</h4>
      {link ? (
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm" htmlFor="share-visitor-link">
            Visitor link (shown once)
            <Input
              id="share-visitor-link"
              onFocus={(event) => event.target.select()}
              readOnly
              value={link}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Anyone with this link{passwordProtected ? " and the password" : ""}{" "}
            can read the approved snapshot. Only a hash of the token is kept, so
            copy it now.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The link is not shown again. Create a new link to copy one; the old
          link stops working.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {link ? (
          <Button onClick={copy} type="button" variant="outline">
            Copy link
          </Button>
        ) : null}
        <Button
          disabled={rotation?.status === "pending"}
          onClick={rotate}
          type="button"
          variant="outline"
        >
          Rotate link
        </Button>
      </div>
      {status ? <p role="status">{status}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <SharePasswordForm
        onRemove={onRemovePassword}
        onSave={onSavePassword}
        passwordProtected={passwordProtected}
      />
    </section>
  );
}
