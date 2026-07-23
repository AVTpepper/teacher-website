import { type ReactNode } from "react";

interface FormFieldProps {
  id?: string;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  helperText?: string;
  characterCount?: number;
  maxLength?: number;
  children: ReactNode;
}

export default function FormField({
  id,
  label,
  description,
  error,
  required,
  optionalLabel,
  helperText,
  characterCount,
  maxLength,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && id && (
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span>{label}</span>
          {required ? (
            <span aria-hidden="true" className="text-error-500">*</span>
          ) : (
            optionalLabel ? <span className="text-xs font-medium text-text-muted">{optionalLabel}</span> : null
          )}
        </label>
      )}

      {description && id && (
        <p id={`${id}-description`} className="text-xs text-text-secondary">
          {description}
        </p>
      )}

      {children}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {error && id ? (
            <p id={`${id}-error`} role="alert" className="text-xs font-medium text-error-700">
              {error}
            </p>
          ) : (
            helperText && id && (
              <p id={`${id}-helper`} className="text-xs text-text-muted">
                {helperText}
              </p>
            )
          )}
        </div>

        {typeof characterCount === "number" && typeof maxLength === "number" && (
          <p className="text-xs text-text-muted" aria-live="polite">
            {characterCount}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
