// biome-ignore-all lint/performance/noJsxPropsBind: The handlers bind to this Project.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ShareRoot } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { useApproveShareScope } from "../../hooks/use-approve-share-scope";
import { LinkSharingView } from "../views/link-sharing-view";

function rootOf(key: string, roots: readonly ShareRoot[]): ShareRoot | null {
  return roots.find((root) => `${root.kind}:${root.id}` === key) ?? null;
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
  const approve = useApproveShareScope();
  const root = rootOf(selectedKey, roots.data ?? []);
  const preview = useQuery({
    ...orpc.previewShareScope.queryOptions({
      input: { root: root ?? { id: "", kind: "Document" } },
    }),
    enabled: root !== null,
  });

  if (roots.isPending) {
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
      formatting={preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES}
      onApprove={(values) =>
        root && preview.data
          ? approve({
              approvedItemIds: values.approved,
              liveItemIds: values.live,
              publishAnyway: values.publishAnyway,
              root,
              surfaceId: preview.data.surface?.surfaceId,
            })
          : Promise.reject(new Error("No scope to approve"))
      }
      onSelectRoot={setSelectedKey}
      preview={preview.data}
      previewError={preview.isError}
      previewLoading={root !== null && preview.isPending}
      roots={roots.data}
      selectedKey={selectedKey}
    />
  );
}
