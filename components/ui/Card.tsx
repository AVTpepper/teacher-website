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
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-card ${
        hoverable
          ? "transition-shadow hover:shadow-card-hover cursor-pointer"
          : ""
      } ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
