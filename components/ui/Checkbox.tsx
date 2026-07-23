"use client";

import { type InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export default function Checkbox({ label, description, className = "", id, ...props }: CheckboxProps) {
  const resolvedId = id ?? `checkbox-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <label htmlFor={resolvedId} className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        id={resolvedId}
        type="checkbox"
        className="focus-ring mt-0.5 h-4 w-4 rounded border-border text-primary-700"
        {...props}
      />
      <span className="min-w-0">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>}
      </span>
    </label>
  );
}
