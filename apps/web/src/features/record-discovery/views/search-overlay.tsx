import { Badge } from "@cantiara/ui/components/badge";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Kbd } from "@cantiara/ui/components/kbd";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useId, useState } from "react";

import { shouldRenderFounderPalette } from "@/features/command-palette/command-palette";
import { usePaletteSurface } from "@/features/command-palette/components/founder-command-palette";
import { projectIdFromPath } from "@/features/personal-shell/components/project-id-from-path";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import {
	PREPARED_INDEX_LABELS,
	preparedIndexHref,
} from "./prepared-index-search";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import { isSearchOpenShortcut, SEARCH_SHORTCUT_HINT } from "./search-surface";

type SearchCopy = typeof RECORD_DISCOVERY_COPY;

interface OverlayHit {
	closureResult: string | null;
	id: string;
	kind: string;
	matchCount: number;
	recordKey: string | null;
	scope: string;
	snippetParts: readonly { highlight: boolean; start: number; text: string }[];
	sourceHref: string;
	status: string;
	title: string;
}

function SearchHitRow({
	copy,
	hit,
	index,
	onClose,
	onSelectIndex,
	selected,
}: {
	copy: SearchCopy;
	hit: OverlayHit;
	index: number;
	onClose: () => void;
	onSelectIndex: (index: number) => void;
	selected: boolean;
}) {
	const onMouseEnter = useCallback(() => {
		onSelectIndex(index);
	}, [index, onSelectIndex]);
	return (
		<li>
			<a
				className={cn(
					"flex flex-col gap-1 rounded-none px-2 py-2 focus-visible:ring-2 focus-visible:ring-ring",
					selected ? "bg-muted text-foreground" : "hover:bg-muted/70"
				)}
				href={hit.sourceHref}
				onClick={onClose}
				onMouseEnter={onMouseEnter}
			>
				<p className="flex min-w-0 items-baseline gap-2">
					<span className="truncate font-medium">{hit.title}</span>
					{hit.recordKey ? (
						<span className="shrink-0 text-muted-foreground text-xs">
							{hit.recordKey}
						</span>
					) : null}
				</p>
				<p className="flex flex-wrap gap-1">
					<Badge variant="outline">{hit.kind}</Badge>
					<Badge variant="outline">{hit.status}</Badge>
					{hit.closureResult ? (
						<Badge variant="outline">{hit.closureResult}</Badge>
					) : null}
					<Badge variant="outline">{hit.scope}</Badge>
					<Badge variant="ghost">
						{hit.matchCount} {copy.matches}
					</Badge>
				</p>
				<p className="text-muted-foreground text-xs">
					{hit.snippetParts.map((part) =>
						part.highlight ? (
							<mark
								className="bg-primary/15 text-foreground"
								key={`${hit.id}-hl-${part.start}`}
							>
								{part.text}
							</mark>
						) : (
							<span key={`${hit.id}-tx-${part.start}`}>{part.text}</span>
						)
					)}
				</p>
			</a>
		</li>
	);
}

export function SearchOverlayTrigger({ onOpen }: { onOpen: () => void }) {
	return (
		<button
			aria-keyshortcuts={SEARCH_SHORTCUT_HINT}
			aria-label={RECORD_DISCOVERY_COPY.search}
			className="flex h-7 w-36 items-center gap-2 rounded-none border border-border bg-background px-2 text-muted-foreground text-sm transition-colors duration-200 ease-out hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-44"
			onClick={onOpen}
			title={`${RECORD_DISCOVERY_COPY.search} (${SEARCH_SHORTCUT_HINT})`}
			type="button"
		>
			<span className="flex-1 truncate text-left">
				{RECORD_DISCOVERY_COPY.search}
			</span>
			<Kbd>{SEARCH_SHORTCUT_HINT}</Kbd>
		</button>
	);
}

export function SearchOverlay() {
	const surface = usePaletteSurface();
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session?.user);
	const mount = shouldRenderFounderPalette(surface, signedIn);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [includeArchived, setIncludeArchived] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const queryId = useId();
	const archiveId = useId();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const openProjectId = projectIdFromPath(pathname);
	const catalog = useQuery({
		...orpc.recordDiscovery.catalog.queryOptions(),
		enabled: mount,
	});
	const copy = catalog.data?.copy ?? RECORD_DISCOVERY_COPY;
	const indexes = catalog.data?.indexes ?? PREPARED_INDEX_LABELS;
	const trimmed = query.trim();
	const result = useQuery({
		...orpc.recordDiscovery.search.queryOptions({
			input: {
				includeArchived,
				openProjectId,
				query: trimmed,
			},
		}),
		enabled: mount && open && trimmed.length > 0,
	});
	const hits = result.data?.hits ?? [];

	const openSearch = useCallback(() => {
		setQuery("");
		setIncludeArchived(false);
		setSelectedIndex(0);
		setOpen(true);
	}, []);
	const closeSearch = useCallback(() => {
		setOpen(false);
	}, []);
	const onOpenChange = useCallback(
		(next: boolean) => {
			if (next) {
				openSearch();
				return;
			}
			closeSearch();
		},
		[closeSearch, openSearch]
	);
	const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value);
		setSelectedIndex(0);
	}, []);
	const onArchiveChange = useCallback((next: boolean | "indeterminate") => {
		setIncludeArchived(next === true);
		setSelectedIndex(0);
	}, []);

	useEffect(() => {
		if (!mount) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				!isSearchOpenShortcut({
					ctrlKey: event.ctrlKey,
					key: event.key,
					metaKey: event.metaKey,
					repeat: event.repeat,
				})
			) {
				return;
			}
			event.preventDefault();
			openSearch();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [mount, openSearch]);

	const onInputKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLInputElement>) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelectedIndex((index) =>
					hits.length === 0 ? 0 : Math.min(index + 1, hits.length - 1)
				);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelectedIndex((index) => Math.max(index - 1, 0));
				return;
			}
			if (event.key === "Enter") {
				const hit = hits.at(selectedIndex) ?? hits.at(0);
				if (!hit) {
					return;
				}
				event.preventDefault();
				closeSearch();
				window.location.assign(hit.sourceHref);
			}
		},
		[closeSearch, hits, selectedIndex]
	);

	if (!mount) {
		return null;
	}

	return (
		<>
			<SearchOverlayTrigger onOpen={openSearch} />
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent
					className="top-[12%] w-full max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
					showCloseButton={false}
				>
					<DialogHeader className="border-b px-3 py-2">
						<DialogTitle className="font-medium text-sm">
							{copy.search}
						</DialogTitle>
					</DialogHeader>
					<div className="border-b px-3 py-2">
						<Field>
							<FieldLabel className="sr-only" htmlFor={queryId}>
								{copy.query}
							</FieldLabel>
							<Input
								autoComplete="off"
								autoFocus
								id={queryId}
								onChange={onQueryChange}
								onKeyDown={onInputKeyDown}
								placeholder={copy.search}
								spellCheck={false}
								value={query}
							/>
						</Field>
					</div>
					<div className="max-h-[min(24rem,50vh)] overflow-auto">
						{result.isError ? (
							<p className="px-3 py-8 text-center text-muted-foreground text-sm">
								{copy.unavailable}
							</p>
						) : null}
						{!result.isError && trimmed.length === 0 ? (
							<div className="flex flex-col gap-2 px-3 py-4">
								<p className="text-center text-muted-foreground text-sm">
									{copy.emptyQuery}
								</p>
								<ul className="flex flex-col">
									{indexes.map((label) => (
										<li key={label}>
											<a
												className="block rounded-none px-2 py-2 text-sm hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
												href={preparedIndexHref(label)}
												onClick={closeSearch}
											>
												{label}
											</a>
										</li>
									))}
								</ul>
							</div>
						) : null}
						{!result.isError &&
						trimmed.length > 0 &&
						!result.isPending &&
						hits.length === 0 ? (
							<p className="px-3 py-8 text-center text-muted-foreground text-sm">
								{copy.noMatches}
							</p>
						) : null}
						{hits.length > 0 ? (
							<ul className="flex flex-col p-1">
								{hits.map((hit, index) => (
									<SearchHitRow
										copy={copy}
										hit={hit}
										index={index}
										key={hit.id}
										onClose={closeSearch}
										onSelectIndex={setSelectedIndex}
										selected={index === selectedIndex}
									/>
								))}
							</ul>
						) : null}
					</div>
					<div className="border-t px-3 py-2">
						<Field orientation="horizontal">
							<Checkbox
								checked={includeArchived}
								id={archiveId}
								onCheckedChange={onArchiveChange}
							/>
							<FieldLabel htmlFor={archiveId}>
								{copy.includeArchived}
							</FieldLabel>
						</Field>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
