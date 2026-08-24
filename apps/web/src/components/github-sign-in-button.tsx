import { Button } from "@cantiara/ui/components/button";
import { Github } from "lucide-react";

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
			<Github />
			Continue with GitHub
		</Button>
	);
}
