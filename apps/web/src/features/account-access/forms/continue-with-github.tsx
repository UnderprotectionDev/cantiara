import { Button } from "@cantiara/ui/components/button";

import { githubWaitCopy } from "@/features/account-access/forms/github-wait";
import { postSignInPath } from "@/features/account-access/forms/post-sign-in-path";
import { authClient } from "@/lib/auth-client";

export default function ContinueWithGitHub({
	availability,
	redirect,
}: {
	availability?: { message?: string; status?: string };
	redirect?: string;
}) {
	const waitingCopy = githubWaitCopy(availability);

	return (
		<div className="flex flex-col gap-3">
			{waitingCopy ? (
				<p className="text-center text-muted-foreground text-sm" role="status">
					{waitingCopy}
				</p>
			) : null}
			<Button
				className="w-full"
				disabled={Boolean(waitingCopy)}
				type="button"
				onClick={() => {
					if (waitingCopy) {
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
