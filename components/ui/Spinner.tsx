export default function Spinner({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "h-4 w-4 border-2" : size === "lg" ? "h-12 w-12 border-4" : "h-8 w-8 border-4";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-spin rounded-full border-primary-500 border-t-transparent ${sizeClass} ${className}`}
    />
  );
}
