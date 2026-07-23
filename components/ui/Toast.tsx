import { type ReactNode } from "react";

type ToastTone = "info" | "success" | "warning" | "error";

interface ToastProps {
  tone?: ToastTone;
  title: string;
  message?: string;
  action?: ReactNode;
}

const toneClasses: Record<ToastTone, string> = {
  info: "border-info-500/35 bg-info-50 text-info-700",
  success: "border-success-500/35 bg-success-50 text-success-700",
  warning: "border-warning-500/35 bg-warning-50 text-warning-700",
  error: "border-error-500/35 bg-error-50 text-error-700",
};

export default function Toast({ tone = "info", title, message, action }: ToastProps) {
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${toneClasses[tone]}`}>
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-1 opacity-90">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
