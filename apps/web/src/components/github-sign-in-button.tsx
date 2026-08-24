import { Button } from "@cantiara/ui/components/button";

import { authClient } from "@/lib/auth-client";

export default function GitHubSignInButton() {
	return (
		<Button
			className="w-full"
			type="button"
			onClick={() => {
				void authClient.signIn.social({
					callbackURL: "/dashboard",
					provider: "github",
				});
			}}
		>
			Continue with GitHub
		</Button>
	);
}
