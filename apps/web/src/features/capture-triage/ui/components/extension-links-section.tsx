import { Button } from "@cantiara/ui/components/button";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import type { MouseEvent } from "react";
import { useCallback } from "react";

import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

import { useExtensionLinks } from "../../hooks/use-extension-links";

export default function ExtensionLinksSection({
  formattingPreferences,
}: {
  formattingPreferences: Parameters<typeof formatAccountDateTime>[1];
}) {
  const { generatePairingCode, links, pairingCode, revokeLink } =
    useExtensionLinks();
  const handleGeneratePairingCode = useCallback(() => {
    generatePairingCode.mutate();
  }, [generatePairingCode]);
  const handleRevokeLink = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const {
        currentTarget: {
          dataset: { linkId },
        },
      } = event;
      if (linkId) {
        revokeLink.mutate(linkId);
      }
    },
    [revokeLink],
  );

  return (
    <section aria-labelledby="extension-links-heading" className="pt-12">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-medium" id="extension-links-heading">
            Extension links
          </h2>
          <p className="mt-1 max-w-xl text-sm/6 text-muted-foreground">
            Pair a browser with Web Capture and revoke individual links when a
            device should stop writing to the Capture Inbox.
          </p>
        </div>
        <Button
          disabled={generatePairingCode.isPending}
          onClick={handleGeneratePairingCode}
          size="sm"
          type="button"
        >
          {generatePairingCode.isPending
            ? "Generating…"
            : "Generate pairing code"}
        </Button>
      </div>

      {pairingCode ? (
        <div
          className="rounded-md border border-primary/25 bg-primary/5 px-4 py-4"
          role="status"
        >
          <p className="text-xs text-muted-foreground">
            This pairing code expires in five minutes and can be used once.
          </p>
          <code className="mt-2 block text-lg font-semibold tracking-wider">
            {pairingCode.code}
          </code>
          <time
            className="mt-1 block text-xs text-muted-foreground"
            dateTime={pairingCode.expiresAt}
          >
            Expires{" "}
            {formatAccountDateTime(
              pairingCode.expiresAt,
              formattingPreferences,
            )}
          </time>
        </div>
      ) : null}

      {links.status === "pending" ? (
        <div className="border-b py-5 text-sm text-muted-foreground">
          Loading Extension links…
        </div>
      ) : null}
      {links.isError ? (
        <div className="border-b py-5 text-sm" role="alert">
          Extension links are unavailable.
        </div>
      ) : null}
      {links.data?.length === 0 ? (
        <p className="border-b py-5 text-sm text-muted-foreground">
          No Extension links.
        </p>
      ) : null}
      {links.data && links.data.length > 0 ? (
        <VirtualList
          className="divide-y border-y border-border/70"
          estimateSize={80}
          gap={8}
          getKey={virtualRowId}
          rows={links.data}
        >
          {(link, rowProps) => (
            <li
              className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              {...rowProps}
            >
              <div className="grid gap-1 text-sm">
                <p className="font-medium">{link.device}</p>
                <p className="text-xs text-muted-foreground">
                  Browser: {link.browser}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last use:{" "}
                  {link.lastUse
                    ? formatAccountDateTime(link.lastUse, formattingPreferences)
                    : "Never"}
                </p>
              </div>
              <Button
                data-link-id={link.id}
                disabled={revokeLink.isPending}
                onClick={handleRevokeLink}
                size="sm"
                type="button"
                variant="destructive"
              >
                Revoke
              </Button>
            </li>
          )}
        </VirtualList>
      ) : null}
    </section>
  );
}
