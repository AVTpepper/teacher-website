"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-ring ${
              icon ? "pl-10" : ""
            } ${
              error
                ? "border-error-500 focus-visible:ring-error-500"
                : "border-border hover:border-border-strong"
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-error-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
