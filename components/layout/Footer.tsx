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
    <footer className="border-t border-primary-700 bg-primary-900 mt-auto text-primary-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="text-lg font-bold text-accent-300"
            >
              EduConnect
            </Link>
            <p className="mt-2 text-sm text-primary-100/90">
              The central hub for educators to connect, collaborate, and grow
              professionally.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-accent-200">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-100/90 hover:text-accent-100 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-primary-700 pt-6 text-center text-xs text-primary-200/80">
          &copy; {new Date().getFullYear()} EduConnect. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
