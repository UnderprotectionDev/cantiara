// biome-ignore-all lint/performance/noJsxPropsBind: The handlers bind to this Project.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ShareRoot } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useLayoutEffect } from "react";
import { env } from "@/env";
import { orpc } from "@/utils/orpc";
import { useApproveShareScope } from "../../hooks/use-approve-share-scope";
import { useShareAccess } from "../../hooks/use-share-access";
import type {
  IssuedShareLink,
  ShareTokenDisplay,
} from "../../lib/share-access";
import { LinkSharingView } from "../views/link-sharing-view";

function rootOf(key: string, roots: readonly ShareRoot[]): ShareRoot | null {
  const root = roots.find((record) => `${record.kind}:${record.id}` === key);
  return root ? { id: root.id, kind: root.kind } : null;
}

/**
 * Loads the Project's shareable main records and the exact closed-world
 * preview of the chosen one, and approves the founder's selection.
 */
interface LinkSharingSurfaceProps {
  onSelectRoot: (key: string) => void;
  projectId: string;
  selectedKey?: string;
}

export default function LinkSharingSurface({
  projectId,
  selectedKey = "",
  onSelectRoot,
}: LinkSharingSurfaceProps) {
  const { session } = useRouteContext({ from: "/_auth" });
  const accountId = session.data.user.id;
  const roots = useQuery(
    orpc.shareRoots.queryOptions({ input: { projectId } }),
  );
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const root = roots.isError ? null : rootOf(selectedKey, roots.data ?? []);
  const rootKey = root && selectedKey;
  const display = useCreateStore({
    issued: null as IssuedShareLink | null,
    latestOperation: 0,
    revokedSurfaceIds: new Set<string>(),
  });
  const issued = useSelector(display, (state) => state.issued);

  function resetDisplay() {
    display.setState((state) => ({
      issued: null,
      latestOperation: state.latestOperation + 1,
      revokedSurfaceIds: new Set(),
    }));
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clean up the previous display before paint and on unmount.
  useLayoutEffect(() => resetDisplay, [display, accountId, projectId, rootKey]);

  const tokenDisplay: ShareTokenDisplay = {
    beginIssuance: () => {
      const latestOperation = display.get().latestOperation + 1;
      display.setState((state) => ({ ...state, latestOperation }));
      return latestOperation;
    },
    receive: (operation, surfaceId, token) => {
      display.setState((state) =>
        state.latestOperation === operation &&
        !state.revokedSurfaceIds.has(surfaceId)
          ? { ...state, issued: token ? { surfaceId, token } : null }
          : state,
      );
    },
    revoke: (surfaceId) => {
      display.setState((state) => ({
        ...state,
        issued: state.issued?.surfaceId === surfaceId ? null : state.issued,
        revokedSurfaceIds: new Set([...state.revokedSurfaceIds, surfaceId]),
      }));
    },
  };
  const approve = useApproveShareScope(tokenDisplay);
  const preview = useQuery({
    ...orpc.previewShareScope.queryOptions({
      input: { root: root ?? { id: "", kind: "Document" } },
    }),
    enabled: root !== null,
  });
  const previewSurfaceId = preview.data?.surface?.surfaceId;
  useLayoutEffect(
    () => () => {
      display.setState((state) =>
        state.issued && state.issued.surfaceId === previewSurfaceId
          ? { ...state, issued: null }
          : state,
      );
    },
    [display, previewSurfaceId],
  );
  const access = useShareAccess(root, previewSurfaceId, tokenDisplay);
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
          issued && issued.surfaceId === previewSurfaceId ? issued.token : null,
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
        if (key !== selectedKey) {
          resetDisplay();
        }
        onSelectRoot(key);
      }}
      preview={preview.data}
      previewError={preview.isError}
      previewLoading={root !== null && preview.isPending}
      roots={roots.data}
      selectedKey={selectedKey}
    />
  );
}
