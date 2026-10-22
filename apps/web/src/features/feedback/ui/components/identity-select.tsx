// biome-ignore-all lint/performance/noJsxPropsBind: The select binds its change handler to the current field.
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";

export interface IdentityOption {
  id: string;
  name: string;
}

export function IdentitySelect({
  disabled,
  id,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: IdentityOption[];
  value: string;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={id}>{label}</label>
      <NativeSelect
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <NativeSelectOption value="">Unknown</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
