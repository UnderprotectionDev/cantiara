import { Button } from "@cantiara/ui/components/button";

import { authClient } from "@/lib/auth-client";

export default function ContinueWithGitHub() {
	return (
		<Button
			className="w-full"
			type="button"
			onClick={() => {
				void authClient.signIn.social({
					callbackURL: `${window.location.origin}/dashboard`,
					provider: "github",
				});
			}}
		>
			Continue with GitHub
		</Button>
	);
}
