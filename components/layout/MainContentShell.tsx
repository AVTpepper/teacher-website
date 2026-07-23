"use client";

import { usePathname } from "next/navigation";

const FULL_BLEED_ROUTES = [
  /^\/educators$/,
  /^\/forums$/,
  /^\/home$/,
  /^\/inspiration$/,
  /^\/jobs$/,
  /^\/resources$/,
  /^\/lesson-builder$/,
  /^\/inspiration\/[^/]+$/,
  /^\/jobs\/[^/]+$/,
  /^\/resources\/[^/]+$/,
  /^\/forums\/[^/]+$/,
  /^\/lesson-builder\/[^/]+$/,
  /^\/educators\/[^/]+\/followers$/,
  /^\/educators\/[^/]+\/following$/,
];

export default function MainContentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDetailRoute = FULL_BLEED_ROUTES.some((pattern) => pattern.test(pathname ?? ""));

  if (isDetailRoute) {
    return <>{children}</>;
  }

  return (
    <div className="surface-panel flex-1 min-w-0 rounded-2xl bg-surface-elevated/90 p-4 backdrop-blur-sm sm:p-6">
      {children}
    </div>
  );
}