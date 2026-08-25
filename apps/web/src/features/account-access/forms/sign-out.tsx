import { DropdownMenuItem } from "@cantiara/ui/components/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { authClient } from "@/lib/auth-client";

export default function SignOut() {
	const navigate = useNavigate();
	const onSignOut = useCallback(() => {
		authClient
			.signOut({
				fetchOptions: {
					onSuccess: async () => {
						const { clearDesktopSessionToken } = await import(
							"@/features/account-access/forms/tauri-session-token"
						);
						await clearDesktopSessionToken();
						navigate({
							to: "/",
						});
					},
				},
			})
			.catch(() => undefined);
	}, [navigate]);

	return (
		<DropdownMenuItem onClick={onSignOut} variant="destructive">
			Sign Out
		</DropdownMenuItem>
	);
}
