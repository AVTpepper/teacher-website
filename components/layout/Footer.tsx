import Link from "next/link";

const footerLinks = [
  {
    title: "Platform",
    links: [
      { href: "/educators", label: "Educators" },
      { href: "/forums", label: "Forums" },
      { href: "/resources", label: "Resources" },
      { href: "/lesson-builder", label: "Lesson Builder" },
      { href: "/inspiration", label: "Inspiration" },
      { href: "/jobs", label: "Jobs" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="type-heading-strong text-lg font-extrabold text-primary-900"
            >
              VistaTeacher
            </Link>
            <p className="type-body-light mt-2 text-sm text-muted">
              The central hub for educators to connect, collaborate, and grow
              professionally.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="type-heading-strong text-xs font-extrabold uppercase tracking-[0.14em] text-primary-900">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="type-body-medium text-sm text-muted hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="type-body-light mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} VistaTeacher. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
