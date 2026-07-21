"use client";

interface TagProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export default function Tag({
  label,
  selected = false,
  onToggle,
  removable = false,
  onRemove,
  className = "",
}: TagProps) {
  return (
    <span
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (onToggle && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        selected
          ? "border border-primary-300 bg-primary-50 text-primary-900"
          : "border border-primary-100 bg-surface text-primary-800 hover:border-primary-200 hover:bg-surface-hover"
      } ${onToggle ? "cursor-pointer" : ""} ${className}`}
    >
      {label}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 h-4 w-4 rounded-full flex items-center justify-center hover:bg-black/10 cursor-pointer"
          aria-label={`Remove ${label}`}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
