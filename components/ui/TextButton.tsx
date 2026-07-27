"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type TextButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  ({ className = "", type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={`touch-target inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TextButton.displayName = "TextButton";

export default TextButton;