import { Button } from "@cantiara/ui/components/button";

import { postSignInPath } from "@/features/account-access/forms/post-sign-in-path";
import {
	isGitHubSignInWaiting,
	WAITING_FOR_GITHUB,
} from "@/features/account-access/forms/waiting-for-github";
import { authClient } from "@/lib/auth-client";

export default function ContinueWithGitHub({
	availability,
	redirect,
}: {
	availability?: "up" | "waiting";
	redirect?: string;
}) {
	const waiting = isGitHubSignInWaiting(availability);

	return (
		<div className="flex flex-col gap-3">
			{waiting ? (
				<p className="text-center text-muted-foreground text-sm" role="status">
					{WAITING_FOR_GITHUB}
				</p>
			) : null}
			<Button
				className="w-full"
				disabled={waiting}
				type="button"
				onClick={() => {
					if (waiting) {
						return;
					}
					const path = postSignInPath(redirect);
					void authClient.signIn.social({
						callbackURL: `${window.location.origin}${path}`,
						provider: "github",
					});
				}}
			>
				Continue with GitHub
			</Button>
		</div>
	);
}
