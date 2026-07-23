"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900",
  secondary:
    "bg-secondary-100 text-primary-900 hover:bg-secondary-200 active:bg-secondary-300",
  outline:
    "border border-border-strong text-foreground hover:bg-surface-hover active:bg-secondary-200",
  ghost:
    "text-primary-700 hover:bg-surface-hover hover:text-foreground active:bg-secondary-200",
  destructive:
    "bg-error-500 text-white hover:bg-error-700 active:bg-error-700",
  link:
    "bg-transparent p-0 text-primary-700 underline-offset-4 hover:underline hover:text-primary-800",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 rounded-md px-3 py-1.5 text-sm gap-1.5",
  md: "min-h-11 rounded-lg px-4 py-2 text-sm gap-2",
  lg: "min-h-12 rounded-lg px-5 py-2.5 text-base gap-2",
  icon: "h-11 w-11 rounded-lg p-0",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingLabel = "Loading",
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={`touch-target inline-flex items-center justify-center font-semibold transition-colors focus-ring disabled:opacity-55 disabled:pointer-events-none cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        <span className="relative inline-flex items-center justify-center gap-2">
          <span className={`inline-flex items-center gap-2 ${isLoading ? "opacity-0" : "opacity-100"}`}>
            {children}
          </span>
          {isLoading && (
            <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="sr-only">{loadingLabel}</span>
            </span>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
