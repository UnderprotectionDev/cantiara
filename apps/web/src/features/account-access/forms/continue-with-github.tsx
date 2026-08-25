import { Button } from "@cantiara/ui/components/button";

import { postSignInPath } from "@/features/account-access/forms/post-sign-in-path";
import { authClient } from "@/lib/auth-client";

export default function ContinueWithGitHub({
	redirect,
}: {
	redirect?: string;
}) {
	return (
		<Button
			className="w-full"
			type="button"
			onClick={() => {
				const path = postSignInPath(redirect);
				void authClient.signIn.social({
					callbackURL: `${window.location.origin}${path}`,
					provider: "github",
				});
			}}
		>
			Continue with GitHub
		</Button>
	);
}
