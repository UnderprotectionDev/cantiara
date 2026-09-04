import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	FAVORITES_COPY,
	type FavoriteSourceType,
	presentFavoriteWriteError,
} from "./favorites-copy";

function sourceQueryKey(sourceId: string, sourceType: FavoriteSourceType) {
	return orpc.favorites.listForSource.queryKey({
		input: { sourceId, sourceType },
	});
}

async function invalidateFavoriteQueries(
	sourceId: string,
	sourceType: FavoriteSourceType
) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: sourceQueryKey(sourceId, sourceType),
		}),
		queryClient.invalidateQueries({
			queryKey: orpc.favorites.openList.queryKey(),
		}),
		queryClient.invalidateQueries({
			queryKey: orpc.favorites.list.queryKey(),
		}),
	]);
}

export default function FavoriteToggle({
	sourceId,
	sourceType,
}: {
	sourceId: string;
	sourceType: FavoriteSourceType;
}) {
	const listed = useQuery(
		orpc.favorites.listForSource.queryOptions({
			input: { sourceId, sourceType },
		})
	);
	const member = listed.data?.[0] ?? null;
	const add = useMutation(
		orpc.favorites.add.mutationOptions({
			onSuccess: async () => {
				await invalidateFavoriteQueries(sourceId, sourceType);
			},
		})
	);
	const remove = useMutation(
		orpc.favorites.remove.mutationOptions({
			onSuccess: async () => {
				await invalidateFavoriteQueries(sourceId, sourceType);
			},
		})
	);
	const onToggle = useCallback(() => {
		if (member) {
			remove.mutate({
				idempotencyKey: newIdempotencyKey(),
				sourceId,
				sourceType,
			});
			return;
		}
		add.mutate({
			idempotencyKey: newIdempotencyKey(),
			sourceId,
			sourceType,
		});
	}, [add, member, remove, sourceId, sourceType]);
	const pending = add.isPending || remove.isPending || listed.isPending;
	const error =
		presentFavoriteWriteError(add.data ?? { status: "committed" }) ??
		presentFavoriteWriteError(remove.data ?? { status: "committed" });
	return (
		<div className="flex flex-col items-start gap-1">
			<Button
				disabled={pending}
				onClick={onToggle}
				size="sm"
				type="button"
				variant="outline"
			>
				{member
					? FAVORITES_COPY.removeFromFavorites
					: FAVORITES_COPY.addToFavorites}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}
