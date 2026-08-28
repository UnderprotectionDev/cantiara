import { orpc, queryClient } from "@/utils/orpc";

export async function invalidateBlockers(projectId: string, workId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.blockers.list.queryKey({
			input: { workId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.get.queryKey({
			input: { workId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.list.queryKey({
			input: { projectId },
		}),
	});
}
