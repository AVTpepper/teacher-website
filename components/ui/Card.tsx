import { type HTMLAttributes } from "react";

type CardPadding = "none" | "sm" | "md" | "lg";
type CardVariant = "standard" | "interactive" | "compact" | "stat" | "profile" | "resource" | "community" | "job";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  hoverable?: boolean;
  variant?: CardVariant;
}

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-3.5",
  md: "p-4",
  lg: "p-6",
};

const variantClasses: Record<CardVariant, string> = {
  standard: "border-border bg-surface",
  interactive: "border-border bg-surface",
  compact: "border-border bg-surface px-3 py-2.5",
  stat: "border-secondary-200 bg-surface-subtle",
  profile: "border-primary-100 bg-surface",
  resource: "border-secondary-200 bg-surface",
  community: "border-primary-100 bg-surface",
  job: "border-secondary-200 bg-surface",
};

export default function Card({
  padding = "md",
  hoverable = false,
  variant = "standard",
  className = "",
  children,
  onClick,
  ...props
}: CardProps) {
  return (
    <div
      className={`surface-panel rounded-xl ${variantClasses[variant]} ${
        hoverable
          ? "surface-panel-hover cursor-pointer"
          : ""
      } ${paddingClasses[padding]} ${className}`}
      onClick={onClick}
      role={hoverable && onClick ? "button" : undefined}
      tabIndex={hoverable && onClick ? 0 : undefined}
      onKeyDown={
        hoverable && onClick
          ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  );
}
