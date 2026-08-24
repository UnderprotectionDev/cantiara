import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export default function Workspace() {
	const accountAccess = useQuery(orpc.accountAccess.me.queryOptions());

	return <p>Workspace {accountAccess.data?.workspaceName}</p>;
}
