import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { FavoriteEntry } from "@cantiara/api/favorites";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useCallback } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { favoritePreviewTarget } from "@/features/favorites/lib/favorite-preview-target";
import { useOpenSourceRecord } from "@/features/record-discovery/ui/components/context-record-preview";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";

function FavoriteRow({
  accountId,
  entry,
  onOpenSource,
  preferences,
}: {
  accountId: string;
  entry: FavoriteEntry;
  onOpenSource: () => void;
  preferences?: AccountPreferences;
}) {
  const openSourceRecord = useOpenSourceRecord();
  const queryClient = useQueryClient();
  const baseOptions = orpc.favoritesList.queryOptions();
  const options = {
    ...baseOptions,
    queryKey: [...baseOptions.queryKey, accountId],
  };
  const opening = useMutation({
    mutationFn: () =>
      client.openFavoriteSource({
        sourceRecordId: entry.sourceRecordId,
        sourceRecordType: entry.sourceRecordType,
      }),
    onSuccess: (resolved) => {
      queryClient.setQueryData(
        options.queryKey,
        (entries: FavoriteEntry[] | undefined) =>
          entries?.map((item) =>
            item.sourceRecordId === resolved.sourceRecordId &&
            item.sourceRecordType === resolved.sourceRecordType
              ? resolved
              : item,
          ),
      );
      const target = favoritePreviewTarget(resolved);
      if (target) {
        onOpenSource();
        openSourceRecord(target);
      }
    },
  });
  const open = useCallback(() => opening.mutate(), [opening.mutate]);
  const current = entry;
  return (
    <li className="space-y-2 rounded-lg border border-border/70 p-4">
      {current.status === "available" ? (
        <>
          <h3 className="break-words font-medium">{current.title}</h3>
          <p className="text-muted-foreground text-sm">
            {current.sourceRecordType}
            {current.life ? ` · ${current.life}` : ""}
          </p>
          <Button
            aria-busy={opening.isPending}
            aria-label={`Open source record: ${current.title}`}
            className="min-h-11"
            disabled={opening.isPending}
            onClick={open}
            type="button"
            variant="outline"
          >
            Open source record
          </Button>
        </>
      ) : (
        <p role="status">Source record is unavailable. {current.reason}</p>
      )}
      <p className="text-muted-foreground text-xs">
        <time dateTime={current.addedAt}>
          {preferences
            ? formatAccountDateTime(current.addedAt, preferences)
            : current.addedAt}
        </time>
      </p>
      {opening.isError ? (
        <p role="alert">Source record is unavailable.</p>
      ) : null}
    </li>
  );
}

export default function FavoritesList({
  onOpenSource,
}: {
  onOpenSource: () => void;
}) {
  const { session } = useRouteContext({ from: "/_auth" });
  const accountId = session.data.user.id;
  const baseOptions = orpc.favoritesList.queryOptions();
  const favorites = useQuery({
    ...baseOptions,
    queryKey: [...baseOptions.queryKey, accountId],
  });
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  if (favorites.isPending) {
    return <p role="status">Loading Favorites…</p>;
  }
  if (favorites.isError) {
    return <p role="alert">Favorites are unavailable.</p>;
  }
  if (favorites.data.length === 0) {
    return (
      <p className="text-muted-foreground" role="status">
        No Favorites yet.
      </p>
    );
  }
  return (
    <ul aria-label="Favorites" className="space-y-3">
      {favorites.data.map((entry) => (
        <FavoriteRow
          accountId={accountId}
          entry={entry}
          key={`${entry.sourceRecordType}:${entry.sourceRecordId}`}
          onOpenSource={onOpenSource}
          preferences={preferences.data}
        />
      ))}
    </ul>
  );
}
