import { type HTMLAttributes } from "react";

type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  hoverable?: boolean;
}

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export default function Card({
  padding = "md",
  hoverable = false,
  className = "",
  children,
  onClick,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border-strong bg-surface/95 shadow-card ${
        hoverable
          ? "transition-shadow hover:shadow-card-hover cursor-pointer"
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
