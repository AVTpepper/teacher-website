"use client";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  legend?: string;
  disabled?: boolean;
}

export default function RadioGroup({ name, value, onChange, options, legend, disabled }: RadioGroupProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      {legend && <legend className="text-sm font-semibold text-text-primary">{legend}</legend>}
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-subtle">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(event) => onChange(event.target.value)}
            className="focus-ring mt-0.5 h-4 w-4 border-border text-primary-700"
          />
          <span>
            <span className="text-sm font-medium text-text-primary">{option.label}</span>
            {option.description && <span className="mt-0.5 block text-xs text-text-secondary">{option.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
