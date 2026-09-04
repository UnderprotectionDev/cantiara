import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { useQuery } from "@tanstack/react-query";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

import { favoriteOpenHref } from "./favorite-open";
import { FAVORITES_COPY } from "./favorites-copy";

interface FavoriteOpenRow {
	createdAt: string;
	id: string;
	openTarget: {
		href: string | null;
		kind: "broken-reference" | "record";
		openSourceRecord: string | null;
		reason?: string;
	};
	sourceId: string;
	sourceType: string;
	title: string | null;
}

export default function FavoritesArea() {
	const opened = useQuery(orpc.favorites.openList.queryOptions());
	const copy = opened.data?.copy ?? {
		favorites: FAVORITES_COPY.favorites,
		openSourceRecord: FAVORITES_COPY.openSourceRecord,
	};
	return (
		<FounderPage title={opened.data?.title ?? copy.favorites}>
			{opened.isError ? <p>{MAIN_FLOW_COPY.failed}</p> : null}
			{opened.data ? (
				<FavoritesList copy={copy} rows={opened.data.rows} />
			) : null}
		</FounderPage>
	);
}

function FavoritesList({
	copy,
	rows,
}: {
	copy: { favorites: string; openSourceRecord: string };
	rows: readonly FavoriteOpenRow[];
}) {
	return (
		<ul aria-label={copy.favorites}>
			{rows.map((row) => (
				<FavoriteRow copy={copy} key={row.id} row={row} />
			))}
		</ul>
	);
}

function FavoriteRow({
	copy,
	row,
}: {
	copy: { openSourceRecord: string };
	row: FavoriteOpenRow;
}) {
	const href = favoriteOpenHref(row.openTarget);
	const label = row.title ?? row.openTarget.reason ?? row.sourceType;
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 border-border border-b py-3">
			<div className="min-w-0">
				<p className="truncate text-sm">
					<span className="font-medium">{row.sourceType}</span>
					{row.title ? <span>{` ${row.title}`}</span> : null}
				</p>
				{row.openTarget.kind === "broken-reference" ? (
					<p className="text-muted-foreground text-sm">
						<span>{row.openTarget.reason}</span>
						<time className="sr-only" dateTime={row.createdAt}>
							{row.createdAt}
						</time>
					</p>
				) : null}
			</div>
			{href ? (
				<a
					aria-label={`${copy.openSourceRecord}: ${label}`}
					className="text-sm underline-offset-4 hover:underline"
					href={href}
				>
					{copy.openSourceRecord}
				</a>
			) : null}
		</li>
	);
}
