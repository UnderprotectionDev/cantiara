import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { projectIdFromPath } from "@/features/personal-shell/components/project-id-from-path";
import { orpc } from "@/utils/orpc";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import { openProjectIdFromLocation } from "./search-open-project";

export default function SearchArea() {
	const catalog = useQuery(orpc.recordDiscovery.catalog.queryOptions());
	const copy = catalog.data?.copy ?? RECORD_DISCOVERY_COPY;
	const location = useRouterState({
		select: (state) => state.location,
	});
	const openProjectId = openProjectIdFromLocation({
		pathname: location.pathname,
		projectFromPath: projectIdFromPath(location.pathname),
		search: location.search as Record<string, unknown>,
	});
	const [query, setQuery] = useState("");
	const [includeArchived, setIncludeArchived] = useState(false);
	const result = useQuery(
		orpc.recordDiscovery.search.queryOptions({
			input: {
				includeArchived,
				openProjectId,
				query,
			},
		})
	);
	const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value);
	}, []);
	const onArchiveChange = useCallback((next: boolean | "indeterminate") => {
		setIncludeArchived(next === true);
	}, []);
	const hits = result.data?.hits ?? [];
	const trimmed = query.trim();

	return (
		<FounderPage title={copy.search} wide>
			<div className="flex flex-col gap-6">
				<Field>
					<FieldLabel htmlFor="record-discovery-query">{copy.query}</FieldLabel>
					<Input
						autoComplete="off"
						id="record-discovery-query"
						onChange={onQueryChange}
						spellCheck={false}
						value={query}
					/>
				</Field>
				<Field orientation="horizontal">
					<Checkbox
						checked={includeArchived}
						id="record-discovery-archived"
						onCheckedChange={onArchiveChange}
					/>
					<FieldLabel htmlFor="record-discovery-archived">
						{copy.includeArchived}
					</FieldLabel>
				</Field>
				{result.isError ? (
					<p className="text-muted-foreground text-sm">{copy.unavailable}</p>
				) : null}
				{trimmed.length === 0 ? (
					<p className="text-muted-foreground text-sm">{copy.emptyQuery}</p>
				) : null}
				{trimmed.length > 0 && !result.isError && hits.length === 0 ? (
					<p className="text-muted-foreground text-sm">{copy.noMatches}</p>
				) : null}
				{hits.length > 0 ? (
					<ul className="flex flex-col gap-4">
						{hits.map((hit) => (
							<li key={hit.id}>
								<a
									className="flex flex-col gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
									href={hit.sourceHref}
								>
									<p className="font-medium text-foreground">{hit.title}</p>
									<p className="flex flex-wrap gap-2 text-muted-foreground text-xs">
										<span>{hit.kind}</span>
										<span>{hit.status}</span>
										{hit.closureResult ? (
											<span>{hit.closureResult}</span>
										) : null}
										<span>{hit.scope}</span>
										<span>
											{hit.matchCount} {copy.matches}
										</span>
									</p>
									<p className="text-sm">
										{hit.snippetParts.map((part) =>
											part.highlight ? (
												<mark
													className="bg-primary/20 text-foreground"
													key={`${hit.id}-hl-${part.start}`}
												>
													{part.text}
												</mark>
											) : (
												<span key={`${hit.id}-tx-${part.start}`}>
													{part.text}
												</span>
											)
										)}
									</p>
								</a>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</FounderPage>
	);
}
