type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-secondary-100 text-secondary-700",
  primary: "bg-primary-100 text-primary-800",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  error: "bg-error-50 text-error-700",
  info: "bg-info-50 text-info-700",
};

export default function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
