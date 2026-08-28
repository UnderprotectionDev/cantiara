import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import { TAGS_COPY } from "./tags-copy";

export default function TagFilter({
	onChange,
	tags,
	value,
}: {
	onChange: (tagId: string) => void;
	tags: Array<{ id: string; name: string }>;
	value: string;
}) {
	const onSelect = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.currentTarget.value);
		},
		[onChange]
	);
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="tag-filter">{TAGS_COPY.filterByTag}</FieldLabel>
			<NativeSelect
				aria-label={TAGS_COPY.tags}
				id="tag-filter"
				onChange={onSelect}
				value={value}
			>
				<NativeSelectOption value="">{TAGS_COPY.allTags}</NativeSelectOption>
				{tags.map((tag) => (
					<NativeSelectOption key={tag.id} value={tag.id}>
						{tag.name}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
