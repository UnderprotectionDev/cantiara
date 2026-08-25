import ContinueWithGitHub from "@/features/account-access/forms/continue-with-github";
import {
	postSignInPath,
	SESSIONS_PATH,
} from "@/features/account-access/forms/post-sign-in-path";

export default function Login({ redirect }: { redirect?: string }) {
	const returningToSessions = postSignInPath(redirect) === SESSIONS_PATH;

	return (
		<div className="mx-auto mt-16 w-full max-w-md p-6">
			<h1 className="mb-2 text-center font-bold text-3xl">Cantiara</h1>
			<p className="mb-8 text-center text-muted-foreground text-sm">
				{returningToSessions
					? "Sign in to open Sessions."
					: "GitHub identity bound to your Account."}
			</p>
			<ContinueWithGitHub redirect={redirect} />
		</div>
	);
}
