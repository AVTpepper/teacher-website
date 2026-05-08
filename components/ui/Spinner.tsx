export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent ${className}`}
    />
  );
}
