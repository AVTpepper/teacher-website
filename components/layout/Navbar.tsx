"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getUser } from "@/lib/firestore/users";
import NavSearchBar from "@/components/layout/NavSearchBar";
import Avatar from "@/components/ui/Avatar";
import Dropdown from "@/components/ui/Dropdown";
import NotificationDropdown from "@/components/layout/NotificationDropdown";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const navLinks = [
  { href: "/home", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/network", label: "Network" },
  { href: "/messages", label: "Messages" },
  { href: "/forums", label: "Communities" },
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlus, setIsPlus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    getUser(user.uid)
      .then((profile) => {
        if (!cancelled) {
          setIsAdmin(profile?.role === "admin");
          setIsPlus(profile?.tier === "plus");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          setIsPlus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/discover") {
      return pathname.startsWith("/discover") || pathname.startsWith("/educators");
    }
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
    <header className="sticky top-0 z-50 border-b border-primary-900/70 bg-primary-950 text-white backdrop-blur supports-backdrop-filter:bg-primary-950/95">
      <div className="app-container">
        {/* Top row: Logo + Search + Actions */}
        <div className="flex h-(--header-height) items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href={user ? "/home" : "/"}
            className="type-heading-strong shrink-0 text-lg font-extrabold text-white"
          >
            VistaTeacher
          </Link>

          {/* Search - hidden on mobile, shown md+ */}
          <div className="mx-4 hidden max-w-xl flex-1 md:block">
            <NavSearchBar placeholder="Search educators, resources, communities..." />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationDropdown />

            <div className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />

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
                        userId={user.uid}
                        showPlusBadge
                        isPlus={isPlus}
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
                      ...(isAdmin
                        ? [
                            {
                              label: "Admin Console",
                              onClick: () => {
                                router.push("/admin");
                              },
                            },
                          ]
                        : []),
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
                    className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-primary-700 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
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
              className="focus-ring touch-target cursor-pointer rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
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
        <nav className="-mb-px hidden gap-1 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`focus-ring rounded-t-md border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive(link.href)
                  ? "border-accent-300 text-white"
                  : "border-transparent text-white/80 hover:border-white/45 hover:text-white"
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
      <div className="fixed inset-0 top-(--header-height) z-40 lg:hidden">
        {/* Backdrop overlay - below header */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Menu panel */}
        <div className="absolute left-0 right-0 top-0 border-t border-primary-900/50 bg-primary-950 shadow-lg">
          {/* Mobile search */}
          <div className="px-4 py-3 md:hidden">
            <NavSearchBar
              placeholder="Search..."
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>

          <nav className="space-y-1 px-2 pb-3 pt-2" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`focus-ring block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-white/10 text-white"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
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
