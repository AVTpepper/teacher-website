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
      className={`rounded-xl border border-primary-100 bg-surface shadow-[0_12px_32px_rgba(15,76,92,0.10)] ${
        hoverable
          ? "transition-shadow hover:shadow-[0_16px_40px_rgba(15,76,92,0.14)] cursor-pointer"
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
