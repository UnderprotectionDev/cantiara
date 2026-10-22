import type { FavoriteSource } from "@cantiara/api/favorites";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export default function FavoriteControl(source: FavoriteSource) {
  const queryClient = useQueryClient();
  const options = orpc.favoriteMembership.queryOptions({ input: source });
  const membership = useQuery(options);
  const isFavorite = membership.data?.isFavorite ?? false;
  const mutation = useMutation({
    mutationFn: () =>
      runOnlineOnlyWrite(() =>
        isFavorite
          ? client.removeFromFavorites(source)
          : client.addToFavorites(source),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({
          queryKey: orpc.favoritesList.queryOptions().queryKey,
        }),
      ]),
  });
  function toggle() {
    mutation.mutate();
  }
  const label = isFavorite ? "Remove from Favorites" : "Add to Favorites";
  const error = membership.error ?? mutation.error;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-busy={membership.isPending || mutation.isPending}
        disabled={
          membership.isPending || membership.isError || mutation.isPending
        }
        onClick={toggle}
        size="sm"
        type="button"
        variant="outline"
      >
        <Star
          aria-hidden="true"
          className={isFavorite ? "fill-current" : undefined}
        />
        {label}
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error instanceof Error
            ? error.message
            : "Favorites could not be saved."}
        </p>
      ) : null}
    </div>
  );
}
