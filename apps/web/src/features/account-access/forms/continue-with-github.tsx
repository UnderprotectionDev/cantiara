import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import { githubWaitCopy } from "@/features/account-access/forms/github-wait";
import { startContinueWithGitHub } from "@/features/account-access/forms/tauri-sign-in";

export default function ContinueWithGitHub({
	availability,
	redirect,
}: {
	availability?: { message?: string; status?: string };
	redirect?: string;
}) {
	const waitingCopy = githubWaitCopy(availability);

	const onContinue = useCallback(() => {
		if (waitingCopy) {
			return;
		}
		startContinueWithGitHub(redirect).catch(() => undefined);
	}, [redirect, waitingCopy]);

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
				onClick={onContinue}
				type="button"
			>
				Continue with GitHub
			</Button>
		</div>
	);
}
