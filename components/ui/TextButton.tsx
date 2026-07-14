"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type TextButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  ({ className = "", type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TextButton.displayName = "TextButton";

export default TextButton;