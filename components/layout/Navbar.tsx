"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import NavSearchBar from "@/components/layout/NavSearchBar";
import Avatar from "@/components/ui/Avatar";
import Dropdown from "@/components/ui/Dropdown";
import NotificationDropdown from "@/components/layout/NotificationDropdown";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const navLinks = [
  { href: "/home", label: "Home" },
  { href: "/educators", label: "Educators" },
  { href: "/forums", label: "Forums" },
  { href: "/resources", label: "Resources" },
  { href: "/lesson-builder", label: "Lesson Builder" },
  { href: "/inspiration", label: "Inspiration" },
  { href: "/jobs", label: "Jobs" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
    <ConfirmDialog
      isOpen={signOutOpen}
      onClose={() => setSignOutOpen(false)}
      onConfirm={async () => {
        setSignOutOpen(false);
        await signOut();
        router.push("/");
      }}
      title="Sign out?"
      description="You will be returned to the home page."
      confirmLabel="Sign out"
      isDestructive={false}
    />
    <header className="sticky top-0 z-50 border-b border-primary-700/60 bg-primary-950/95 text-primary-50 backdrop-blur supports-backdrop-filter:bg-primary-950/90 shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top row: Logo + Search + Actions */}
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href={user ? "/home" : "/"}
            className="shrink-0 text-lg font-bold text-accent-300"
          >
            EduConnect
          </Link>

          {/* Search - hidden on mobile, shown md+ */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <NavSearchBar placeholder="Search educators, resources, discussions..." />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationDropdown />

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
                          router.push("/profile");
                        },
                      },
                      {
                        label: "Account Management",
                        onClick: () => {
                          router.push("/account");
                        },
                      },
                      {
                        label: "Sign out",
                        onClick: () => setSignOutOpen(true),
                        destructive: true,
                      },
                    ]}
                  />
                ) : (
                  <Link
                    href="/auth/login"
                    className="rounded-lg bg-accent-400 px-3.5 py-1.5 text-sm font-semibold text-primary-950 hover:bg-accent-300 transition-colors"
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
              className="lg:hidden rounded-lg p-2 text-primary-100 hover:bg-primary-800 hover:text-white transition-colors cursor-pointer"
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
                  ? "border-accent-400 text-accent-200"
                  : "border-transparent text-primary-100 hover:text-accent-100 hover:border-primary-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>

    {/* Mobile menu - rendered outside header to avoid stacking context issues */}
    {mobileMenuOpen && (
      <div className="fixed inset-0 top-14 z-40 overflow-y-auto lg:hidden">
        {/* Backdrop overlay - below header */}
        <div
          className="absolute inset-0 bg-primary-950/65"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Menu panel */}
        <div className="absolute left-0 right-0 top-0 border-t border-primary-700 bg-primary-900 shadow-lg max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
          {/* Mobile search */}
          <div className="px-4 py-3 md:hidden">
            <NavSearchBar
              placeholder="Search..."
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>

          <nav className="px-2 pb-6 space-y-1" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`inline-flex rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                      ? "bg-accent-300 text-primary-950"
                      : "text-primary-100 hover:bg-primary-800 hover:text-accent-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    )}
    </>
  );
}
