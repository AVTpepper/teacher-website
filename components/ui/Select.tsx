"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";
import FormField from "./FormField";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
  helperText?: string;
  optionalLabel?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, description, helperText, optionalLabel, required, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const describedBy = [
      description ? `${selectId}-description` : null,
      helperText ? `${selectId}-helper` : null,
      error ? `${selectId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <FormField
        id={selectId}
        label={label}
        description={description}
        error={error}
        helperText={helperText}
        required={required}
        optionalLabel={optionalLabel}
      >
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-foreground transition-colors focus-ring cursor-pointer ${
            error
              ? "border-error-500 focus-visible:ring-error-500"
              : "border-border hover:border-border-strong focus-visible:border-primary-300"
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
);

Select.displayName = "Select";
export default Select;
