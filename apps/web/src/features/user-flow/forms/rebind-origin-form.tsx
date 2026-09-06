import { Button } from "@cantiara/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { USER_FLOW_COPY } from "./user-flow-copy";

export default function RebindOriginForm({
	nodeId,
	onRebound,
	recordId,
	recordKind,
	sourceVersion,
	userFlowId,
}: {
	nodeId: string;
	onRebound: () => Promise<void>;
	recordId: string;
	recordKind: string;
	sourceVersion: string | null;
	userFlowId: string;
}) {
	const [open, setOpen] = useState(false);
	const preview = useQuery({
		...orpc.userFlow.previewRebindOrigin.queryOptions({
			input: { nodeId, recordId, recordKind, userFlowId },
		}),
		enabled: open,
	});
	const rebind = useMutation(
		orpc.userFlow.rebindOrigin.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await onRebound();
					setOpen(false);
				}
			},
		})
	);
	const onOpen = useCallback(() => {
		setOpen(true);
	}, []);
	const onConfirm = useCallback(() => {
		if (preview.data?.status !== "ok") {
			return;
		}
		rebind.mutate({
			idempotencyKey: newIdempotencyKey(),
			payload: { nodeId, recordId, recordKind, userFlowId },
			previewAcknowledged: true,
		});
	}, [nodeId, preview.data, rebind, recordId, recordKind, userFlowId]);
	const previewOk = preview.data?.status === "ok" ? preview.data.preview : null;

	return (
		<>
			<Button onClick={onOpen} type="button" variant="outline">
				{USER_FLOW_COPY.rebind}
			</Button>
			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{USER_FLOW_COPY.rebind}</DialogTitle>
					</DialogHeader>
					<dl className="flex flex-col gap-1 text-sm">
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{USER_FLOW_COPY.originLocation}
							</dt>
							<dd>{sourceVersion}</dd>
						</div>
						{previewOk ? (
							<div className="flex gap-2">
								<dt className="text-muted-foreground">
									{USER_FLOW_COPY.originLocation}
								</dt>
								<dd>
									{previewOk.fromVersion} → {previewOk.toVersion}
								</dd>
							</div>
						) : null}
					</dl>
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
