import Link from "next/link";
import Card from "@/components/ui/Card";

export default function Sidebar() {
  return (
    <aside className="hidden xl:block w-72 flex-shrink-0 space-y-4">
      {/* Trending Discussions */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Trending Discussions
        </h3>
        <p className="text-xs text-muted">No discussions yet.</p>
      </Card>

      {/* Latest Resources */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Latest Resources
        </h3>
        <p className="text-xs text-muted">No resources yet.</p>
      </Card>

      {/* Suggested Educators */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Suggested Educators
        </h3>
        <p className="text-xs text-muted">No suggestions yet.</p>
      </Card>

      {/* Quick Links */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Quick Links
        </h3>
        <ul className="space-y-1.5">
          {[
            { href: "/resources", label: "Browse Resources" },
            { href: "/lesson-builder", label: "Create a Lesson" },
            { href: "/forums", label: "Join a Discussion" },
            { href: "/jobs", label: "Find Jobs" },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-muted hover:text-primary-900 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}
