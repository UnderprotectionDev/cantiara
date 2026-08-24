import ContinueWithGitHub from "@/features/account-access/forms/continue-with-github";

export default function Login() {
	return (
		<div className="mx-auto mt-16 w-full max-w-md p-6">
			<h1 className="mb-2 text-center font-bold text-3xl">Cantiara</h1>
			<p className="mb-8 text-center text-muted-foreground text-sm">
				GitHub identity bound to your Account.
			</p>
			<ContinueWithGitHub />
		</div>
	);
}
