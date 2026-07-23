"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import FormField from "./FormField";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  description?: string;
  helperText?: string;
  optionalLabel?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", id, description, helperText, optionalLabel, required, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const describedBy = [
      description ? `${inputId}-description` : null,
      helperText ? `${inputId}-helper` : null,
      error ? `${inputId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <FormField
        id={inputId}
        label={label}
        description={description}
        error={error}
        helperText={helperText}
        required={required}
        optionalLabel={optionalLabel}
      >
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy || undefined}
            className={`w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-ring ${
              icon ? "pl-10" : ""
            } ${
              error
                ? "border-error-500 focus-visible:ring-error-500"
                : "border-border hover:border-border-strong focus-visible:border-primary-300"
            } ${className}`}
            {...props}
          />
        </div>
      </FormField>
    );
  }
);

Input.displayName = "Input";
export default Input;
