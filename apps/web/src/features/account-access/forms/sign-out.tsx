import { DropdownMenuItem } from "@cantiara/ui/components/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export default function SignOut() {
	const navigate = useNavigate();

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => {
				authClient.signOut({
					fetchOptions: {
						onSuccess: () => {
							navigate({
								to: "/",
							});
						},
					},
				});
			}}
		>
			Sign Out
		</DropdownMenuItem>
	);
}
