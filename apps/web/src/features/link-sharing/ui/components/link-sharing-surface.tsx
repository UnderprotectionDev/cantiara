// biome-ignore-all lint/performance/noJsxPropsBind: The handlers bind to this Project.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ShareRoot } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { env } from "@/env";
import { orpc } from "@/utils/orpc";
import { useApproveShareScope } from "../../hooks/use-approve-share-scope";
import { useShareAccess } from "../../hooks/use-share-access";
import type { IssuedShareLink } from "../../lib/share-access";
import { LinkSharingView } from "../views/link-sharing-view";

function rootOf(key: string, roots: readonly ShareRoot[]): ShareRoot | null {
  const root = roots.find((record) => `${record.kind}:${record.id}` === key);
  return root ? { id: root.id, kind: root.kind } : null;
}

/**
 * Loads the Project's shareable main records and the exact closed-world
 * preview of the chosen one, and approves the founder's selection.
 */
export default function LinkSharingSurface({
  projectId,
}: {
  projectId: string;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const roots = useQuery(
    orpc.shareRoots.queryOptions({ input: { projectId } }),
  );
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const [issued, setIssued] = useState<IssuedShareLink | null>(null);
  const approve = useApproveShareScope(setIssued);
  const root = rootOf(selectedKey, roots.data ?? []);
  const preview = useQuery({
    ...orpc.previewShareScope.queryOptions({
      input: { root: root ?? { id: "", kind: "Document" } },
    }),
    enabled: root !== null,
  });
  const surfaceId = preview.data?.surface?.surfaceId;
  const access = useShareAccess(root, surfaceId, setIssued, () =>
    setIssued(null),
  );
  const revoked =
    access.lifecycleFeedback?.action === "revoke" &&
    access.lifecycleFeedback.status === "success";

  if (roots.status === "pending") {
    return <p role="status">Loading Share…</p>;
  }
  if (roots.isError || !roots.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Share is unavailable.</p>
        <Button
          onClick={() => {
            roots.refetch().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <LinkSharingView
      access={{
        issuedToken:
          issued && issued.surfaceId === surfaceId ? issued.token : null,
        onRemovePassword: () => access.setPassword(null),
        onRotate: access.rotateToken,
        onSavePassword: (password) => access.setPassword(password),
        rotation: access.rotationFeedback,
        serverUrl: env.VITE_SERVER_URL,
      }}
      formatting={preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES}
      lifecycle={{
        feedback: access.lifecycleFeedback,
        onReopen: (expiresAt) => access.reopen(expiresAt),
        onReshare: access.reshare,
        onRevoke: access.revoke,
        onSetExpiry: (expiresAt) => access.setExpiry(expiresAt),
      }}
      notice={
        revoked
          ? "Link revoked. It can never be used again; approving the scope again makes a new link."
          : null
      }
      onApprove={async (values) => {
        if (!(root && preview.data)) {
          throw new Error("No scope to approve");
        }
        return await approve({
          approvedItemIds: values.approved,
          liveItemIds: values.live,
          publishAnyway: values.publishAnyway,
          root,
          surfaceId: preview.data.surface?.surfaceId,
        });
      }}
      onSelectRoot={(key) => {
        access.resetFeedback();
        setSelectedKey(key);
      }}
      preview={preview.data}
      previewError={preview.isError}
      previewLoading={root !== null && preview.isPending}
      roots={roots.data}
      selectedKey={selectedKey}
    />
  );
}
