"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";

type DetailRoute = {
  pattern: RegExp;
  href: string;
  label: string;
};

const DETAIL_ROUTES: DetailRoute[] = [
  { pattern: /^\/inspiration\/[^/]+$/, href: "/inspiration", label: "← Back to Inspiration" },
  { pattern: /^\/jobs\/[^/]+$/, href: "/jobs", label: "← Back to Job Board" },
  { pattern: /^\/resources\/[^/]+$/, href: "/resources", label: "← Back to Resources" },
  { pattern: /^\/forums\/[^/]+$/, href: "/forums", label: "← Back to Forums" },
  { pattern: /^\/lesson-builder\/[^/]+$/, href: "/lesson-builder", label: "← Back to Lesson Builder" },
  { pattern: /^\/educators\/[^/]+\/followers$/, href: "", label: "← Back to profile" },
  { pattern: /^\/educators\/[^/]+\/following$/, href: "", label: "← Back to profile" },
];

export default function MainDetailBackButton() {
  const pathname = usePathname();
  const route = DETAIL_ROUTES.find((entry) => entry.pattern.test(pathname ?? ""));

  if (!route) return null;

  const href = route.href || (pathname?.includes("/educators/") ? pathname.split("/").slice(0, 3).join("/") : "/");

  return (
    <div className="mb-4">
      <Link href={href}>
        <Button variant="outline" size="sm" className="gap-1.5">
          {route.label}
        </Button>
      </Link>
    </div>
  );
}