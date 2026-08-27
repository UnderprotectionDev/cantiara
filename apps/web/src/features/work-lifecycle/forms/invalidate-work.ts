import { orpc, queryClient } from "@/utils/orpc";

export async function invalidateWork(projectId: string, workId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.list.queryKey({
			input: { projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.get.queryKey({
			input: { workId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.getScope.queryKey({
			input: { workId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.progress.queryKey({
			input: { workId },
		}),
	});
}
