import { useQuery } from "@tanstack/react-query";

import {
	type EvidenceTargetKind,
	EVIDENCE_COPY,
} from "@/features/evidence/forms/evidence-copy";
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
	const pins = useQuery(
		orpc.evidence.listOnTarget.queryOptions({
			input: { targetId, targetKind },
		})
	);
	const listed = pins.data ?? [];
	if (listed.length === 0) {
		return null;
	}
	return (
		<section className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">
				{EVIDENCE_COPY.versionPinnedEvidence}
			</h3>
			{listed.map((pin) => (
				<p className="text-muted-foreground text-sm" key={pin.id}>
					{pin.contentAccess === "open" ? pin.rangeText : ""}
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
			))}
		</section>
	);
}
