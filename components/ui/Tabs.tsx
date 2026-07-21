"use client";

import { useState } from "react";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";

interface Tab {
  label: string;
  value: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  variant?: "underline" | "pill";
}

export default function Tabs({
  tabs,
  defaultValue,
  onChange,
  className = "",
  variant = "underline",
}: TabsProps) {
  const [active, setActive] = useState(defaultValue || tabs[0]?.value);

  function handleSelect(value: string) {
    setActive(value);
    onChange?.(value);
  }

  if (variant === "pill") {
    return (
      <div
        className={`flex flex-wrap gap-2 ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active === tab.value}
            onClick={() => handleSelect(tab.value)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors cursor-pointer ${
              active === tab.value
                ? "border-accent-300 bg-accent-50 text-primary-900"
                : "border-primary-100 bg-surface text-primary-800 hover:border-primary-200 hover:bg-surface-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <HorizontalScrollHint
      className={className}
      innerClassName="flex gap-1 border-b border-border"
      role="tablist"
      nudgeKey="tabs-underline"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => handleSelect(tab.value)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 -mb-px ${
            active === tab.value
              ? "border-primary-900 text-primary-900"
              : "border-transparent text-muted hover:text-foreground hover:border-secondary-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </HorizontalScrollHint>
  );
}
