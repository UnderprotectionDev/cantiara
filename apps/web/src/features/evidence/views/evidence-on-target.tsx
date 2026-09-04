import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
	EVIDENCE_COPY,
	EVIDENCE_ROLES,
	type EvidenceRole,
	type EvidenceTargetKind,
} from "@/features/evidence/forms/evidence-copy";
import { EvidenceRoleFields } from "@/features/evidence/views/evidence-role-fields";
import { orpc } from "@/utils/orpc";

export default function EvidenceOnTarget({
	projectId,
	targetId,
	targetKind,
}: {
	projectId: string;
	targetId: string;
	targetKind: EvidenceTargetKind;
}) {
	const [openedRole, setOpenedRole] = useState<EvidenceRole | null>(null);
	const surface = useQuery(
		orpc.evidence.surfaceOnTarget.queryOptions({
			input: { targetId, targetKind },
		})
	);
	const onOpenRole = useCallback((role: EvidenceRole) => {
		setOpenedRole((current) => (current === role ? null : role));
	}, []);
	const groups = surface.data?.groups ?? [];
	const total = groups.reduce((sum, group) => sum + group.count, 0);
	if (total === 0) {
		return null;
	}
	const opened =
		openedRole === null
			? groups.flatMap((group) => group.pins)
			: (groups.find((group) => group.role === openedRole)?.pins ?? []);
	return (
		<section className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">
				{EVIDENCE_COPY.versionPinnedEvidence}
			</h3>
			<div className="flex flex-wrap gap-2">
				{EVIDENCE_ROLES.map((role) => (
					<RoleCountButton
						count={groups.find((item) => item.role === role)?.count ?? 0}
						key={role}
						onOpen={onOpenRole}
						opened={openedRole === role}
						role={role}
					/>
				))}
			</div>
			{opened.map((pin) => (
				<div className="flex flex-col gap-2" key={pin.id}>
					<p className="text-muted-foreground text-sm">
						{pin.role}
						{pin.contentAccess === "open" ? ` · ${pin.rangeText}` : ""}
						{pin.sourceKind === "Source" ? (
							<>
								{" · "}
								<a
									href={`/projects/${projectId}?source=${encodeURIComponent(pin.sourceId)}#source`}
								>
									{pin.openSourceRecord}
								</a>
							</>
						) : (
							` · ${pin.openSourceRecord}`
						)}
						{pin.newerVersionExists
							? ` · ${EVIDENCE_COPY.newerVersionExists}`
							: ""}
					</p>
					{pin.founderInterpretation ? (
						<p className="text-sm">
							{EVIDENCE_COPY.founderInterpretation}: {pin.founderInterpretation}
						</p>
					) : null}
					<EvidenceRoleFields
						founderInterpretation={pin.founderInterpretation}
						pinId={pin.id}
						role={pin.role}
						targetId={targetId}
						targetKind={targetKind}
					/>
				</div>
			))}
		</section>
	);
}

function RoleCountButton({
	count,
	onOpen,
	opened,
	role,
}: {
	count: number;
	onOpen: (role: EvidenceRole) => void;
	opened: boolean;
	role: EvidenceRole;
}) {
	const onClick = useCallback(() => {
		onOpen(role);
	}, [onOpen, role]);
	return (
		<Button
			aria-pressed={opened}
			onClick={onClick}
			type="button"
			variant={opened ? "default" : "outline"}
		>
			{role} {count}
		</Button>
	);
}
