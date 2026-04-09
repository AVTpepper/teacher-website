"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
}

export default function Dropdown({
  trigger,
  items,
  align = "left",
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer"
      >
        {trigger}
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1.5 min-w-45 rounded-lg border border-border bg-surface shadow-lg py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
                item.destructive
                  ? "text-error-500 hover:bg-error-50"
                  : "text-foreground hover:bg-surface-hover"
              }`}
            >
              {item.icon && (
                <span className="shrink-0 w-4 h-4">{item.icon}</span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
