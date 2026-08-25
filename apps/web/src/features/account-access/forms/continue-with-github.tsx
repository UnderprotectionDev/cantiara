import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import { startContinueWithGitHub } from "@/features/account-access/forms/tauri-sign-in";

export default function ContinueWithGitHub({
	redirect,
}: {
	redirect?: string;
}) {
	const onContinue = useCallback(() => {
		startContinueWithGitHub(redirect).catch(() => undefined);
	}, [redirect]);

	return (
		<Button className="w-full" onClick={onContinue} type="button">
			Continue with GitHub
		</Button>
	);
}
