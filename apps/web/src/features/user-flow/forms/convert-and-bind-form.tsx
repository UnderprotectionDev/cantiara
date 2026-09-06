import { Button } from "@cantiara/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { CONVERT_RECORD_KINDS, USER_FLOW_COPY } from "./user-flow-copy";

export default function ConvertAndBindForm({
	baseRevision,
	nodeId,
	onConverted,
	userFlowId,
}: {
	baseRevision: number;
	nodeId: string;
	onConverted: () => Promise<void>;
	userFlowId: string;
}) {
	const [open, setOpen] = useState(false);
	const [recordKind, setRecordKind] = useState<
		(typeof CONVERT_RECORD_KINDS)[number]
	>(USER_FLOW_COPY.work);
	const preview = useQuery({
		...orpc.userFlow.previewConvertAndBind.queryOptions({
			input: { nodeId, recordKind, userFlowId },
		}),
		enabled: open,
	});
	const convert = useMutation(
		orpc.userFlow.convertAndBind.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await onConverted();
					setOpen(false);
				}
			},
		})
	);
	const onOpen = useCallback(() => {
		setOpen(true);
	}, []);
	const onKind = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRecordKind(event.target.value as (typeof CONVERT_RECORD_KINDS)[number]);
	}, []);
	const onConfirm = useCallback(() => {
		if (preview.data?.status !== "ok") {
			return;
		}
		convert.mutate({
			baseRevision,
			idempotencyKey: newIdempotencyKey(),
			payload: { nodeId, recordKind, userFlowId },
			previewAcknowledged: true,
		});
	}, [baseRevision, convert, nodeId, preview.data, recordKind, userFlowId]);

	const previewOk = preview.data?.status === "ok" ? preview.data.preview : null;

	return (
		<>
			<Button onClick={onOpen} type="button" variant="outline">
				{USER_FLOW_COPY.convertAndBind}
			</Button>
			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{USER_FLOW_COPY.convertAndBind}</DialogTitle>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={`convert-kind-${nodeId}`}>
								{USER_FLOW_COPY.convertAndBind}
							</FieldLabel>
							<NativeSelect
								id={`convert-kind-${nodeId}`}
								onChange={onKind}
								value={recordKind}
							>
								{CONVERT_RECORD_KINDS.map((kind) => (
									<NativeSelectOption key={kind} value={kind}>
										{kind}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</FieldGroup>
					{previewOk ? (
						<dl className="flex flex-col gap-1 text-sm">
							<div className="flex gap-2">
								<dt className="text-muted-foreground">
									{USER_FLOW_COPY.title}
								</dt>
								<dd>{previewOk.title}</dd>
							</div>
							<div className="flex gap-2">
								<dt className="text-muted-foreground">
									{USER_FLOW_COPY.originLocation}
								</dt>
								<dd>
									{previewOk.originLocation.ownerId} ·{" "}
									{previewOk.originLocation.componentId} ·{" "}
									{previewOk.originLocation.sourceVersion}
								</dd>
							</div>
							<div className="flex gap-2">
								<dt className="text-muted-foreground">
									{USER_FLOW_COPY.origin}
								</dt>
								<dd>{previewOk.origin}</dd>
							</div>
						</dl>
					) : null}
					<DialogFooter>
						<Button disabled={!previewOk} onClick={onConfirm} type="button">
							{USER_FLOW_COPY.confirm}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
