import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

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
					{latestCheck.candidate ? (
						<p className="whitespace-pre-wrap">
							{latestCheck.candidate.capturedContent}
						</p>
					) : null}
					{compare.data
						? compare.data.pinMatches.map((pin) => (
								<p key={pin.pinId}>
									{pin.match === "none"
										? SOURCES_COPY.noMatchInCandidateVersion
										: pin.rangeText}
								</p>
							))
						: null}
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
	rebindUse: (input: {
		idempotencyKey: string;
		payload: { pinId: string };
	}) => Promise<unknown>;
	use: {
		accessedAt: string;
		id: string;
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
				<p>{SOURCES_COPY.newerSourceVersionExists}</p>
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
