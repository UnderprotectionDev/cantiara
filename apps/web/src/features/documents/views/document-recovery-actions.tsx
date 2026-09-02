import { Button } from "@cantiara/ui/components/button";
import { EmptyContent } from "@cantiara/ui/components/empty";
import { useCallback } from "react";

export function DocumentRecoveryActions({
	copyLabel,
	downloadLabel,
	filename,
	markdown,
}: {
	copyLabel: string;
	downloadLabel: string;
	filename: string;
	markdown: string;
}) {
	const onCopy = useCallback(() => {
		navigator.clipboard.writeText(markdown).catch(() => undefined);
	}, [markdown]);
	const onDownload = useCallback(() => {
		const blob = new Blob([markdown], {
			type: "text/markdown;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.download = filename;
		link.href = url;
		link.click();
		URL.revokeObjectURL(url);
	}, [filename, markdown]);

	return (
		<EmptyContent>
			<Button onClick={onCopy} type="button">
				{copyLabel}
			</Button>
			<Button onClick={onDownload} type="button">
				{downloadLabel}
			</Button>
		</EmptyContent>
	);
}
