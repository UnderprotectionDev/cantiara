import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import {
	type ChangeEvent,
	type FormEvent,
	useCallback,
	useId,
	useState,
} from "react";

import {
	EVIDENCE_COPY,
	EVIDENCE_ROLES,
	type EvidenceRole,
} from "@/features/evidence/forms/evidence-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export function EvidenceRoleFields({
	founderInterpretation,
	pinId,
	role,
	sourceId,
	sourceKind,
	targetId,
	targetKind,
}: {
	founderInterpretation: string;
	pinId: string;
	role: EvidenceRole;
	sourceId?: string;
	sourceKind?: string;
	targetId?: string;
	targetKind?: string;
}) {
	const roleId = useId();
	const interpretationId = useId();
	const [selectedRole, setSelectedRole] = useState<EvidenceRole>(role);
	const [interpretation, setInterpretation] = useState(founderInterpretation);
	const invalidate = useCallback(async () => {
		if (sourceId && sourceKind) {
			await queryClient.invalidateQueries({
				queryKey: orpc.evidence.listOnSource.queryKey({
					input: { sourceId, sourceKind },
				}),
			});
		}
		if (targetId && targetKind) {
			await queryClient.invalidateQueries({
				queryKey: orpc.evidence.listOnTarget.queryKey({
					input: { targetId, targetKind },
				}),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.evidence.surfaceOnTarget.queryKey({
					input: { targetId, targetKind },
				}),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.evidence.listFlow.queryKey({
					input: { targetId, targetKind },
				}),
			});
		}
	}, [sourceId, sourceKind, targetId, targetKind]);
	const setRole = useMutation(
		orpc.evidence.setRole.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
		})
	);
	const writeInterpretation = useMutation(
		orpc.evidence.setFounderInterpretation.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
		})
	);
	const onSaveRole = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			setRole.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { pinId, role: selectedRole },
			});
		},
		[pinId, selectedRole, setRole]
	);
	const onSaveInterpretation = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			writeInterpretation.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { founderInterpretation: interpretation, pinId },
			});
		},
		[interpretation, pinId, writeInterpretation]
	);
	const onRole = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setSelectedRole(event.target.value as EvidenceRole);
	}, []);
	const onInterpretation = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setInterpretation(event.target.value);
		},
		[]
	);
	return (
		<div className="flex flex-col gap-2">
			<form className="flex flex-col gap-2" onSubmit={onSaveRole}>
				<Field>
					<FieldLabel htmlFor={roleId}>{EVIDENCE_COPY.evidenceRole}</FieldLabel>
					<NativeSelect id={roleId} onChange={onRole} value={selectedRole}>
						{EVIDENCE_ROLES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button type="submit">{EVIDENCE_COPY.evidenceRole}</Button>
			</form>
			<form className="flex flex-col gap-2" onSubmit={onSaveInterpretation}>
				<Field>
					<FieldLabel htmlFor={interpretationId}>
						{EVIDENCE_COPY.founderInterpretation}
					</FieldLabel>
					<Textarea
						id={interpretationId}
						onChange={onInterpretation}
						value={interpretation}
					/>
				</Field>
				<Button type="submit">{EVIDENCE_COPY.founderInterpretation}</Button>
			</form>
		</div>
	);
}
