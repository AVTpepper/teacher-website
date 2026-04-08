"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { SearchBar } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import Dropdown from "@/components/ui/Dropdown";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/educators", label: "Educators" },
  { href: "/forums", label: "Forums" },
  { href: "/resources", label: "Resources" },
  { href: "/lesson-builder", label: "Lesson Builder" },
  { href: "/inspiration", label: "Inspiration" },
  { href: "/jobs", label: "Jobs" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top row: Logo + Search + Actions */}
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex-shrink-0 text-lg font-bold text-primary-900"
          >
            EduConnect
          </Link>

          {/* Search — hidden on mobile, shown md+ */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <SearchBar placeholder="Search educators, resources, discussions..." />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              type="button"
              className="relative rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </button>

            {/* User menu */}
            {!loading && (
              <>
                {user ? (
                  <Dropdown
                    align="right"
                    trigger={
                      <Avatar
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        size="sm"
                      />
                    }
                    items={[
                      {
                        label: "Profile",
                        onClick: () => {
                          window.location.href = "/profile";
                        },
                      },
                      {
                        label: "Settings",
                        onClick: () => {
                          window.location.href = "/profile/edit";
                        },
                      },
                      {
                        label: "Sign out",
                        onClick: () => signOut(),
                        destructive: true,
                      },
                    ]}
                  />
                ) : (
                  <Link
                    href="/auth/login"
                    className="rounded-lg bg-primary-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
                  >
                    Sign in
                  </Link>
                )}
              </>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex gap-1 -mb-px" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive(link.href)
                  ? "border-primary-900 text-primary-900"
                  : "border-transparent text-muted hover:text-foreground hover:border-secondary-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-surface">
          {/* Mobile search */}
          <div className="px-4 py-3 md:hidden">
            <SearchBar placeholder="Search..." />
          </div>

          <nav className="px-2 pb-3 space-y-1" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-primary-50 text-primary-900"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
