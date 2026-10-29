// biome-ignore-all lint/performance/noJsxPropsBind: The handlers bind to this surface.

import { SHARE_TOKEN_LABEL } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";
import { writeTextToClipboard } from "@/lib/clipboard";
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
  serverUrl,
}: {
  issuedToken: string | null;
  onRemovePassword: () => Promise<unknown>;
  onRotate: () => Promise<unknown>;
  onSavePassword: (password: string) => Promise<unknown>;
  passwordProtected: boolean;
  serverUrl: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const link = issuedToken ? shareVisitorUrl(serverUrl, issuedToken) : null;

  async function copy() {
    if (!link) {
      return;
    }
    setFailed(false);
    try {
      await writeTextToClipboard(link);
      setStatus("Link copied.");
    } catch {
      setStatus(null);
      setFailed(true);
    }
  }
  async function rotate() {
    setStatus(null);
    setFailed(false);
    try {
      await onRotate();
      setStatus("New link created. The old link and every open visit ended.");
    } catch {
      setFailed(true);
    }
  }
  return (
    <section aria-label="Link access" className="space-y-4">
      <h4 className="font-medium text-sm">{SHARE_TOKEN_LABEL}</h4>
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
          <p className="text-muted-foreground text-xs">
            Anyone with this link{passwordProtected ? " and the password" : ""}{" "}
            can read the approved snapshot. Only a hash of the token is kept, so
            copy it now.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
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
        <Button onClick={rotate} type="button" variant="outline">
          Rotate link
        </Button>
      </div>
      {status ? <p role="status">{status}</p> : null}
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          That did not work. Try again.
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
