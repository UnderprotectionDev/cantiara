import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";
import {
	bulkClusterPlacementOptions,
	bulkSenseMakingColumns,
	captureInboxItemPreview,
	nextBulkPosition,
} from "./capture-form-state";
import { CaptureTriageActions, type TriageCopy } from "./capture-triage-panel";

export function CaptureBulkSenseMaking({
	copy,
	onItemConsumed,
	onMergeConsumed,
	templates,
}: {
	copy: TriageCopy & {
		bulkSenseMaking: string;
		save: string;
		ungrouped: string;
	};
	onItemConsumed: (itemId: string) => void;
	onMergeConsumed: (mergeId: string) => void;
	templates?: ReadonlyArray<{ id: string; label: string }>;
}) {
	const [clusterName, setClusterName] = useState("");
	const bulk = useQuery(orpc.captureInbox.bulkSenseMaking.queryOptions());
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.captureInbox.bulkSenseMaking.queryKey(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.captureInbox.listAll.queryKey(),
		});
	}, []);
	const nameCluster = useMutation(
		orpc.captureInbox.nameBulkCluster.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setClusterName("");
			},
		})
	);
	const place = useMutation(
		orpc.captureInbox.placeInBulk.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
		})
	);
	const columns = useMemo(
		() =>
			bulk.data
				? bulkSenseMakingColumns({
						clusters: bulk.data.clusters,
						items: bulk.data.items,
						placements: bulk.data.placements,
					})
				: [],
		[bulk.data]
	);
	const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setClusterName(event.target.value);
	}, []);
	const onNameSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const name = clusterName.trim();
			if (!name) {
				return;
			}
			nameCluster.mutate({
				idempotencyKey: newIdempotencyKey(),
				name,
			});
		},
		[clusterName, nameCluster]
	);
	const onPlace = useCallback(
		(itemId: string, clusterId: string | null) => {
			place.mutate({
				clusterId,
				idempotencyKey: newIdempotencyKey(),
				itemId,
				position: nextBulkPosition(bulk.data?.placements ?? [], clusterId),
			});
		},
		[bulk.data?.placements, place]
	);

	if (bulk.isError) {
		return null;
	}

	return (
		<section aria-label={copy.bulkSenseMaking} className="flex flex-col gap-4">
			<form className="flex flex-wrap items-end gap-2" onSubmit={onNameSubmit}>
				<Field className="min-w-48 flex-1">
					<FieldLabel htmlFor="bulk-cluster-name">
						{copy.bulkSenseMaking}
					</FieldLabel>
					<Input
						id="bulk-cluster-name"
						onChange={onNameChange}
						value={clusterName}
					/>
				</Field>
				<Button size="sm" type="submit">
					{copy.save}
				</Button>
			</form>
			<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
				{columns.map((column) => (
					<section
						aria-label={column.name ?? copy.bulkSenseMaking}
						className="min-w-0 border-border border-t pt-3"
						key={column.clusterId ?? "ungrouped"}
					>
						{column.name ? (
							<h3 className="mb-3 font-medium text-sm">{column.name}</h3>
						) : (
							<h3 className="mb-3 font-medium text-sm">{copy.ungrouped}</h3>
						)}
						<ul className="flex flex-col">
							{column.items.map((item) => {
								const templateLabel =
									templates?.find((template) => template.id === item.template)
										?.label ?? item.template;
								const currentClusterId =
									bulk.data?.placements.find(
										(placement) => placement.itemId === item.id
									)?.clusterId ?? "";
								return (
									<li className="border-border border-b py-3" key={item.id}>
										<p className="whitespace-pre-wrap text-sm">
											{captureInboxItemPreview(item, templateLabel)}
										</p>
										<BulkClusterSelect
											clusters={bulk.data?.clusters ?? []}
											itemId={item.id}
											label={copy.bulkSenseMaking}
											onPlace={onPlace}
											ungrouped={copy.ungrouped}
											value={currentClusterId}
										/>
										<CaptureTriageActions
											copy={copy}
											itemId={item.id}
											onItemConsumed={onItemConsumed}
											onMergeConsumed={onMergeConsumed}
										/>
									</li>
								);
							})}
						</ul>
					</section>
				))}
			</div>
		</section>
	);
}

function BulkClusterSelect({
	clusters,
	itemId,
	label,
	onPlace,
	ungrouped,
	value,
}: {
	clusters: Array<{ id: string; name: string }>;
	itemId: string;
	label: string;
	onPlace: (itemId: string, clusterId: string | null) => void;
	ungrouped: string;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onPlace(itemId, event.target.value || null);
		},
		[itemId, onPlace]
	);
	const options = bulkClusterPlacementOptions({ clusters, ungrouped });
	return (
		<NativeSelect
			aria-label={label}
			className="mt-3 w-full"
			id={`bulk-cluster-${itemId}`}
			onChange={onChange}
			value={value}
		>
			{options.map((option) => (
				<NativeSelectOption
					key={option.clusterId ?? "ungrouped"}
					value={option.clusterId ?? ""}
				>
					{option.name}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}
