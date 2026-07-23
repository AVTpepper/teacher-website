import Link from "next/link";

const footerLinks = [
  {
    title: "Explore",
    links: [
      { href: "/educators", label: "Discover Educators" },
      { href: "/forums", label: "Communities" },
      { href: "/resources", label: "Resources" },
      { href: "/lesson-builder", label: "Lesson Builder" },
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
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/auth/signup", label: "Join Free" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-primary-900/70 bg-primary-950 text-white">
      <div className="app-container py-10 lg:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="type-heading-strong text-lg font-extrabold text-white"
            >
              VistaTeacher
            </Link>
            <p className="mt-2 text-sm text-white/75">
              The central hub for educators to connect, collaborate, and grow
              professionally.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h2 className="type-meta text-accent-300 uppercase tracking-[0.14em]">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/75 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-white/15 pt-6 text-center text-xs text-white/65">
          &copy; {new Date().getFullYear()} VistaTeacher. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
