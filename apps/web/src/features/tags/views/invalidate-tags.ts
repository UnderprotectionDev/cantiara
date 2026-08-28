import { orpc, queryClient } from "@/utils/orpc";

export async function invalidateTags(
	projectId: string,
	workId: string,
	tagId?: string
) {
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
		queryKey: orpc.workLifecycle.get.queryKey({
			input: { workId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.tags.list.queryKey(),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.tags.suggest.queryKey({
			input: { projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.tags.listWorkTags.queryKey({
			input: { projectId },
		}),
	});
	if (tagId) {
		await queryClient.invalidateQueries({
			queryKey: orpc.tags.listRecords.queryKey({
				input: { tagId },
			}),
		});
	}
}
