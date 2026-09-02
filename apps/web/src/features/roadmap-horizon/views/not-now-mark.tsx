import { ROADMAP_COPY } from "./roadmap-copy";

export default function NotNowMark({
	reason,
}: {
	reason: string | null | undefined;
}) {
	if (!reason) {
		return null;
	}
	return (
		<details className="text-muted-foreground text-xs">
			<summary className="cursor-pointer">{ROADMAP_COPY.notNow}</summary>
			<p className="pt-1 text-foreground">{reason}</p>
		</details>
	);
}
