import { USED_IN_QUERY_ROOT } from "@/features/relations/views/used-in-query-key";
import { orpc, queryClient } from "@/utils/orpc";

export async function invalidateRoadmapHorizon() {
	await queryClient.invalidateQueries({
		predicate: (query) =>
			JSON.stringify(query.queryKey).includes("roadmapHorizon"),
	});
}

export async function invalidateWork(projectId: string, workId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.list.queryKey({
			input: { archived: false, projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.list.queryKey({
			input: { archived: true, projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.list.queryKey({
			input: { projectId },
		}),
	});
	await queryClient.invalidateQueries({
		predicate: (query) => {
			const serialized = JSON.stringify(query.queryKey);
			return serialized.includes("backlog") && serialized.includes("list");
		},
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
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.getScopeTree.queryKey({
			input: { projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.kanban.board.queryKey({
			input: { projectId },
		}),
	});
	await invalidateRoadmapHorizon();
	await queryClient.invalidateQueries({
		predicate: (query) => JSON.stringify(query.queryKey).includes("dailyFocus"),
	});
	await queryClient.invalidateQueries({
		predicate: (query) =>
			JSON.stringify(query.queryKey).includes("focusPeriod"),
	});
	await queryClient.invalidateQueries({
		queryKey: [USED_IN_QUERY_ROOT],
	});
	await queryClient.invalidateQueries({
		predicate: (query) =>
			JSON.stringify(query.queryKey).includes("unifiedCalendar"),
	});
}
