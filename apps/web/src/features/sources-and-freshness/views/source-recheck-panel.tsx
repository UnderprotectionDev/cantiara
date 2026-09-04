import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { SOURCES_COPY } from "../forms/sources-copy";

export default function SourceRecheckPanel({
	projectId,
	sourceId,
}: {
	projectId: string;
	sourceId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const compareRef = useRef<HTMLDivElement>(null);
	const freshness = useQuery(
		orpc.sources.freshness.queryOptions({ input: { sourceId } })
	);
	const preview = useQuery(
		orpc.sources.recheckPreview.queryOptions({ input: { sourceId } })
	);
	const latestCheck = freshness.data?.checks.at(-1);
	const compare = useQuery({
		...orpc.sources.compareCheck.queryOptions({
			input: { checkId: latestCheck?.id ?? "" },
		}),
		enabled: Boolean(latestCheck?.id),
	});
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.sources.get.queryKey({ input: { sourceId } }),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.sources.list.queryKey({ input: { projectId } }),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.sources.freshness.queryKey({ input: { sourceId } }),
		});
		if (latestCheck?.id) {
			await queryClient.invalidateQueries({
				queryKey: orpc.sources.compareCheck.queryKey({
					input: { checkId: latestCheck.id },
				}),
			});
		}
	}, [latestCheck?.id, projectId, sourceId]);
	const recheck = useMutation(
		orpc.sources.recheck.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				recordSave();
			},
		})
	);
	const keepVersion = useMutation(
		orpc.sources.keepCurrentVersion.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				recordSave();
			},
		})
	);
	const saveVersion = useMutation(
		orpc.sources.saveCheckVersion.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				recordSave();
			},
		})
	);
	const keepUse = useMutation(
		orpc.sources.keepEvidenceUse.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
				}
			},
		})
	);
	const rebindUse = useMutation(
		orpc.sources.rebindEvidenceUse.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
				}
			},
		})
	);
	const onRecheck = useCallback(() => {
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			recheck.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: { sourceId },
			})
		);
	}, [attemptOnlineWork, markUnsaved, recheck, sourceId]);
	const onKeepVersion = useCallback(() => {
		if (!latestCheck) {
			return;
		}
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			keepVersion.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: { checkId: latestCheck.id },
			})
		);
	}, [attemptOnlineWork, keepVersion, latestCheck, markUnsaved]);
	const onSaveVersion = useCallback(() => {
		if (!(latestCheck && freshness.data)) {
			return;
		}
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			saveVersion.mutateAsync({
				baseRevision: freshness.data.source.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { checkId: latestCheck.id },
			})
		);
	}, [
		attemptOnlineWork,
		freshness.data,
		latestCheck,
		markUnsaved,
		saveVersion,
	]);
	const openCompare = useCallback(() => {
		compareRef.current?.scrollIntoView({ block: "nearest" });
		compareRef.current?.focus();
	}, []);

	return (
		<section className="flex flex-col gap-3">
			<h3 className="text-muted-foreground text-xs">
				{SOURCES_COPY.sourceCheck}
			</h3>
			{preview.data ? (
				<div className="flex flex-col gap-1 text-sm">
					<p className="break-all">{preview.data.startUrl}</p>
					<p>
						{`${SOURCES_COPY.approvedVersion} ${preview.data.approvedVersionNumber}`}
					</p>
					<p>{SOURCES_COPY.thirdPartyFetchWillOccur}</p>
				</div>
			) : null}
			<Button onClick={onRecheck} type="button">
				{SOURCES_COPY.recheckSource}
			</Button>
			{latestCheck ? (
				<div className="flex flex-col gap-2 text-sm">
					<p>{`${SOURCES_COPY.sourceCheck} ${latestCheck.startedAt}`}</p>
					<p>{latestCheck.httpResult}</p>
					{latestCheck.failureReason ? (
						<p role="status">{latestCheck.failureReason}</p>
					) : null}
					{latestCheck.candidate && compare.data ? (
						<div
							className="flex flex-col gap-2"
							id="source-check-compare"
							ref={compareRef}
							tabIndex={-1}
						>
							<div className="grid gap-2 md:grid-cols-2">
								<section>
									<h4 className="text-muted-foreground text-xs">
										{SOURCES_COPY.approvedVersion}
									</h4>
									<p className="whitespace-pre-wrap">
										{compare.data.approvedContent}
									</p>
								</section>
								<section>
									<h4 className="text-muted-foreground text-xs">
										{SOURCES_COPY.sourceCheck}
									</h4>
									<p className="whitespace-pre-wrap">
										{compare.data.candidateContent}
									</p>
								</section>
							</div>
							{compare.data.lineChanges.some(
								(part) => part.added || part.removed
							) ? (
								<ol className="flex flex-col gap-1">
									{compare.data.lineChanges.map((part) => (
										<li
											className={lineChangeClassName(part)}
											key={lineChangeKey(part)}
										>
											{part.value}
										</li>
									))}
								</ol>
							) : null}
							{compare.data.pinMatches.map((pin) => (
								<p key={pin.pinId}>
									{pin.match === "none"
										? SOURCES_COPY.noMatchInCandidateVersion
										: pin.rangeText}
								</p>
							))}
						</div>
					) : null}
					{latestCheck.candidate && latestCheck.disposition === "open" ? (
						<div className="flex flex-wrap gap-2">
							<Button onClick={onKeepVersion} type="button">
								{SOURCES_COPY.keepCurrentVersion}
							</Button>
							<Button onClick={onSaveVersion} type="button">
								{SOURCES_COPY.saveAsNewSourceVersion}
							</Button>
						</div>
					) : null}
				</div>
			) : null}
			{freshness.data?.uses.map((use) => (
				<SourceEvidenceUseRow
					attemptOnlineWork={attemptOnlineWork}
					keepUse={keepUse.mutateAsync}
					key={use.id}
					markUnsaved={markUnsaved}
					onOpenCompare={openCompare}
					rebindUse={rebindUse.mutateAsync}
					use={use}
				/>
			))}
			{rebindUse.data?.status === "rejected" &&
			rebindUse.data.reason === "no-match-in-candidate-version" ? (
				<p role="alert">{SOURCES_COPY.noMatchInCandidateVersion}</p>
			) : null}
		</section>
	);
}

function SourceEvidenceUseRow({
	attemptOnlineWork,
	keepUse,
	markUnsaved,
	onOpenCompare,
	rebindUse,
	use,
}: {
	attemptOnlineWork: (
		kind: "record-create",
		run: () => Promise<unknown>
	) => void;
	keepUse: (input: {
		idempotencyKey: string;
		payload: { pinId: string };
	}) => Promise<unknown>;
	markUnsaved: () => void;
	onOpenCompare: () => void;
	rebindUse: (input: {
		idempotencyKey: string;
		payload: { pinId: string };
	}) => Promise<unknown>;
	use: {
		accessedAt: string;
		id: string;
		matchAgainstApproved: "exact" | "none";
		newerSourceVersionExists: boolean;
		rangeText: string;
		reviewed: boolean;
		sourceVersionNumber: number;
		targetKind: string;
	};
}) {
	const onKeep = useCallback(() => {
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			keepUse({
				idempotencyKey: newIdempotencyKey(),
				payload: { pinId: use.id },
			})
		);
	}, [attemptOnlineWork, keepUse, markUnsaved, use.id]);
	const onRebind = useCallback(() => {
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			rebindUse({
				idempotencyKey: newIdempotencyKey(),
				payload: { pinId: use.id },
			})
		);
	}, [attemptOnlineWork, markUnsaved, rebindUse, use.id]);
	return (
		<div className="flex flex-col gap-2 border border-input p-2">
			<p>{`${use.targetKind} · ${SOURCES_COPY.approvedVersion} ${use.sourceVersionNumber}`}</p>
			<p>{`${SOURCES_COPY.accessedAt} ${use.accessedAt}`}</p>
			<p className="whitespace-pre-wrap">{use.rangeText}</p>
			{use.newerSourceVersionExists ? (
				<Button onClick={onOpenCompare} type="button">
					{SOURCES_COPY.newerSourceVersionExists}
				</Button>
			) : null}
			{use.newerSourceVersionExists ? (
				<p>
					{use.matchAgainstApproved === "none"
						? SOURCES_COPY.noMatchInCandidateVersion
						: use.rangeText}
				</p>
			) : null}
			{use.newerSourceVersionExists && !use.reviewed ? (
				<div className="flex flex-wrap gap-2">
					<Button onClick={onKeep} type="button">
						{SOURCES_COPY.reviewedKeepCurrentVersion}
					</Button>
					<Button onClick={onRebind} type="button">
						{SOURCES_COPY.rebindToNewVersion}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function lineChangeClassName(part: {
	added: boolean;
	removed: boolean;
}): string {
	if (part.removed) {
		return "whitespace-pre-wrap text-muted-foreground line-through";
	}
	if (part.added) {
		return "whitespace-pre-wrap font-medium";
	}
	return "whitespace-pre-wrap text-muted-foreground";
}

function lineChangeKey(part: {
	added: boolean;
	removed: boolean;
	value: string;
}): string {
	if (part.added) {
		return `added:${part.value}`;
	}
	if (part.removed) {
		return `removed:${part.value}`;
	}
	return `same:${part.value}`;
}
