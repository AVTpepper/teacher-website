"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";

const publicNavLinks = [
  { href: "/pricing", label: "Plans" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function PublicNavbar() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <header className="sticky top-0 z-50 border-b border-primary-900/70 bg-primary-950 text-white backdrop-blur supports-backdrop-filter:bg-primary-950/95">
        <div className="app-container">
          <div className="flex h-(--header-height) items-center justify-between gap-4">
            <Skeleton className="h-6 w-36 bg-white/15" />
            <div className="hidden items-center gap-2 lg:flex">
              <Skeleton className="h-9 w-16 rounded-lg bg-white/10" />
              <Skeleton className="h-9 w-24 rounded-lg bg-white/10" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-primary-900/70 bg-primary-950 text-white backdrop-blur supports-backdrop-filter:bg-primary-950/95">
      <div className="app-container">
        <div className="flex h-(--header-height) items-center justify-between gap-4">
          <Link href={user ? "/home" : "/"} className="focus-ring rounded-md text-lg font-bold">
            VistaTeacher
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Public">
            {publicNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring rounded-md px-3 py-2 text-sm font-semibold text-white/85 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <Link href="/home" className="focus-ring rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold hover:bg-primary-800">
                Go to Your Dashboard
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="focus-ring rounded-md px-3 py-2 text-sm font-semibold text-white/85 hover:text-white">
                  Log In
                </Link>
                <Link href="/auth/signup" className="focus-ring rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
                  Create Profile
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {!user && (
              <Link
                href="/auth/login"
                className="focus-ring rounded-md px-2.5 py-2 text-sm font-semibold text-white/90 hover:text-white"
              >
                Log In
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="focus-ring touch-target rounded-lg p-2"
              aria-expanded={mobileOpen}
              aria-label="Toggle public menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-primary-900/70 bg-primary-950 lg:hidden">
          <nav className="app-container space-y-1 py-3" aria-label="Public mobile">
            {publicNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring block rounded-md px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-white/15 pt-2" />
            {user ? (
              <Link
                href="/home"
                className="focus-ring block rounded-lg bg-primary-700 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                Go to Your Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="focus-ring block rounded-md px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/auth/signup"
                  className="focus-ring mt-1 block rounded-lg bg-accent-500 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  Create Profile
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
