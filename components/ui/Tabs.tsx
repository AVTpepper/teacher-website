"use client";

import { useState } from "react";

interface Tab {
  label: string;
  value: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export default function Tabs({
  tabs,
  defaultValue,
  onChange,
  className = "",
}: TabsProps) {
  const [active, setActive] = useState(defaultValue || tabs[0]?.value);

  function handleSelect(value: string) {
    setActive(value);
    onChange?.(value);
  }

  return (
    <div
      className={`flex gap-1 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
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
    </div>
  );
}
