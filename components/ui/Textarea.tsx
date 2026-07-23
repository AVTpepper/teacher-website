"use client";

import { type TextareaHTMLAttributes, forwardRef } from "react";
import FormField from "./FormField";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  description?: string;
  helperText?: string;
  optionalLabel?: string;
  showCharacterCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    label,
    error,
    className = "",
    id,
    description,
    helperText,
    optionalLabel,
    showCharacterCount = false,
    required,
    maxLength,
    value,
    ...props
  }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const currentLength = typeof value === "string" ? value.length : undefined;
    const describedBy = [
      description ? `${textareaId}-description` : null,
      helperText ? `${textareaId}-helper` : null,
      error ? `${textareaId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <FormField
        id={textareaId}
        label={label}
        description={description}
        error={error}
        helperText={helperText}
        required={required}
        optionalLabel={optionalLabel}
        characterCount={showCharacterCount ? currentLength : undefined}
        maxLength={showCharacterCount ? maxLength : undefined}
      >
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          className={`w-full min-h-24 resize-y rounded-lg border bg-white px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-ring sm:text-sm ${
            error
              ? "border-error-500 focus-visible:ring-error-500"
              : "border-border hover:border-border-strong focus-visible:border-primary-300"
          } ${className}`}
          {...props}
        />
      </FormField>
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;
