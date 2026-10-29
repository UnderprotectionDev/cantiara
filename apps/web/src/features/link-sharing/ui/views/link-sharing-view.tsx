// biome-ignore-all lint/performance/noJsxPropsBind: The picker binds to its own state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  PREVIEW_SCOPE_LABEL,
  SHARE_LABEL,
  type ShareRootSummary,
  type ShareScopePreview,
} from "@cantiara/api/link-sharing";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { ShareScopeStatus } from "../components/share-scope-status";
import {
  ShareScopeForm,
  type ShareScopeFormSubmit,
} from "../forms/share-scope-form";

/**
 * Share: pick one main record, read the exact closed world that would leave,
 * then approve it. A visitor link, password, expiry and revoke are not here.
 */
export function LinkSharingView({
  formatting,
  onApprove,
  onSelectRoot,
  preview,
  previewError,
  previewLoading,
  roots,
  selectedKey,
}: {
  formatting: AccountPreferences;
  onApprove: (values: ShareScopeFormSubmit) => Promise<unknown>;
  onSelectRoot: (key: string) => void;
  preview?: ShareScopePreview;
  previewError: boolean;
  previewLoading: boolean;
  roots: readonly ShareRootSummary[];
  selectedKey: string;
}) {
  return (
    <section aria-label={SHARE_LABEL} className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-2xl tracking-tight">{SHARE_LABEL}</h2>
        <p className="text-muted-foreground text-sm">
          Nothing leaves until you approve the exact records, fields, versions
          and files below. Folders, relations and views never add to the scope.
        </p>
      </header>
      <label className="grid gap-2 text-sm" htmlFor="share-root">
        Record to share
        <NativeSelect
          id="share-root"
          onChange={(event) => onSelectRoot(event.target.value)}
          value={selectedKey}
        >
          <NativeSelectOption value="">Choose a record</NativeSelectOption>
          {roots.map((root) => (
            <NativeSelectOption
              key={`${root.kind}:${root.id}`}
              value={`${root.kind}:${root.id}`}
            >
              {root.kind}: {root.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      {selectedKey ? (
        <section aria-label={PREVIEW_SCOPE_LABEL} className="space-y-4">
          <h3 className="font-medium">{PREVIEW_SCOPE_LABEL}</h3>
          {previewLoading ? <p role="status">Loading the scope…</p> : null}
          {previewError ? (
            <p role="alert">The scope preview is unavailable.</p>
          ) : null}
          {preview ? (
            <>
              <ShareScopeStatus formatting={formatting} preview={preview} />
              <ShareScopeForm
                key={`${preview.root.kind}:${preview.root.id}:${preview.surface?.revision ?? 0}`}
                onSubmit={onApprove}
                preview={preview}
              />
            </>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
