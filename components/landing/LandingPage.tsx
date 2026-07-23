"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Section,
} from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth-context";
import { searchEducators, type UserProfile } from "@/lib/firestore/users";

type HomepageEvent =
  | "hero_primary_cta"
  | "hero_secondary_cta"
  | "preview_profile_open"
  | "ecosystem_communities_click"
  | "ecosystem_resources_click"
  | "ecosystem_jobs_click"
  | "final_primary_cta"
  | "final_secondary_cta";

function trackHomepageAction(_event: HomepageEvent) {
  // Analytics integration boundary for existing provider wiring.
  void _event;
}

interface PublicEducatorPreview {
  uid: string;
  displayName: string;
  photoURL: string | null;
  gradeLevel: string;
  subjects: string[];
  country?: string;
  bio?: string;
}

const publicNavLinks = [
  { href: "/educators", label: "Discover" },
  { href: "/forums", label: "Communities" },
  { href: "/resources", label: "Resources" },
  { href: "/jobs", label: "Jobs" },
];

const intentCards = [
  {
    title: "Teachers in your subject",
    description: "Find educators sharing practical ideas in your teaching area.",
    marker: "01",
    href: "/educators",
  },
  {
    title: "International educators",
    description: "Learn from classrooms, systems, and perspectives around the world.",
    marker: "02",
    href: "/educators",
  },
  {
    title: "Collaborators",
    description: "Connect with peers for projects, planning, and professional support.",
    marker: "03",
    href: "/educators",
  },
  {
    title: "Mentors",
    description: "Discover experienced educators who can guide your growth.",
    marker: "04",
    href: "/educators",
  },
  {
    title: "Education professionals",
    description: "Explore profiles beyond classrooms across the education sector.",
    marker: "05",
    href: "/educators",
  },
];

const ecosystemCards = [
  {
    title: "Communities",
    description: "Discuss shared challenges and practical ideas with educators.",
    href: "/forums",
    event: "ecosystem_communities_click" as const,
  },
  {
    title: "Resources",
    description: "Discover and share teaching materials that save planning time.",
    href: "/resources",
    event: "ecosystem_resources_click" as const,
  },
  {
    title: "Lesson Builder",
    description: "Create and refine lesson plans with structured workflows.",
    href: "/lesson-builder",
  },
  {
    title: "Jobs",
    description: "Explore teaching and education opportunities.",
    href: "/jobs",
    event: "ecosystem_jobs_click" as const,
  },
  {
    title: "Inspiration",
    description: "Read educator stories, ideas, and professional reflections.",
    href: "/inspiration",
  },
];

function mapEducatorPreview(profile: UserProfile): PublicEducatorPreview {
  return {
    uid: profile.uid,
    displayName: profile.displayName,
    photoURL: profile.photoURL ?? null,
    gradeLevel: profile.gradeLevel,
    subjects: profile.subjects ?? [],
    country: profile.country,
    bio: profile.bio,
  };
}

function PreviewExampleCard() {
  return (
    <Card variant="profile" padding="md" className="h-full">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-full bg-secondary-100" aria-hidden="true" />
        <div className="min-w-0">
          <p className="type-card-title text-sm text-foreground">Educator profile preview</p>
          <p className="mt-1 text-xs text-text-secondary">
            Example Discover card layout for public educator profiles.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="default">Grade level</Badge>
            <Badge variant="primary">Subject</Badge>
            <Badge variant="info">Location</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PublicHomepageNav() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <header className="sticky top-0 z-40 border-b border-primary-900/70 bg-primary-950 text-white">
        <div className="app-container flex h-(--header-height) items-center justify-between">
          <span className="type-heading-strong text-lg">VistaTeacher</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-primary-900/70 bg-primary-950 text-white">
      <div className="app-container">
        <div className="flex h-(--header-height) items-center justify-between gap-4">
          <Link href="/" className="focus-ring rounded-md text-lg font-bold">
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
                  Join Free
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="focus-ring touch-target rounded-lg p-2 lg:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle public menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
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
                  Join Free
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [previewEducators, setPreviewEducators] = useState<PublicEducatorPreview[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(false);

      try {
        const result = await searchEducators({}, null);
        if (cancelled) return;

        const topProfiles = result.educators
          .filter((profile) => profile.displayName && profile.uid)
          .slice(0, 6)
          .map(mapEducatorPreview);

        setPreviewEducators(topProfiles);
      } catch {
        if (!cancelled) {
          setPreviewEducators([]);
          setPreviewError(true);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, []);

  const isAuthenticated = Boolean(user);
  const primaryHeroCta = isAuthenticated
    ? { label: "Go to Your Dashboard", href: "/home" }
    : { label: "Create Your Free Profile", href: "/auth/signup" };
  const finalCta = isAuthenticated
    ? { label: "Explore Your Network", href: "/educators" }
    : { label: "Join VistaTeacher - It is Free", href: "/auth/signup" };

  return (
    <div className="flex min-h-screen flex-col bg-page-background text-text-primary">
      <PublicHomepageNav />

      <main className="flex-1">
        <section className="border-b border-border/60 bg-linear-to-b from-primary-950 via-primary-900 to-primary-800 text-white">
          <div className="app-container grid gap-10 py-16 lg:grid-cols-[1.1fr,0.9fr] lg:items-center lg:py-20">
            <div>
              <p className="type-meta uppercase tracking-[0.18em] text-accent-300">The professional network for educators</p>
              <h1 className="type-page-title mt-4 text-4xl text-white sm:text-5xl">
                Find Your People in Education
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
                Connect with educators who share your subjects, curriculum, interests, and ambitions.
                Build your professional network, exchange ideas, discover opportunities, and grow together.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryHeroCta.href}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-600"
                  onClick={() => trackHomepageAction("hero_primary_cta")}
                >
                  {primaryHeroCta.label}
                </Link>
                <Link
                  href="/educators"
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-white/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  onClick={() => trackHomepageAction("hero_secondary_cta")}
                >
                  Explore Educators
                </Link>
              </div>

              <p className="mt-4 text-sm text-white/80">Free to join. Built specifically for educators.</p>
            </div>

            <div className="space-y-3">
              <p className="type-meta text-white/80">Discover preview</p>
              {previewLoading ? (
                <ListSkeleton rows={3} />
              ) : previewEducators.length > 0 ? (
                <div className="grid gap-3">
                  {previewEducators.slice(0, 3).map((educator) => (
                    <Link
                      key={educator.uid}
                      href={`/educators/${educator.uid}`}
                      className="focus-ring block"
                      onClick={() => trackHomepageAction("preview_profile_open")}
                    >
                      <Card variant="profile" padding="md" className="border-white/30 bg-white/95">
                        <div className="flex items-start gap-3">
                          <Avatar src={educator.photoURL} alt={educator.displayName} size="md" />
                          <div className="min-w-0">
                            <p className="type-card-title truncate text-sm text-foreground">{educator.displayName}</p>
                            <p className="mt-0.5 truncate text-xs text-text-secondary">
                              {educator.gradeLevel || "Educator"}
                              {educator.country ? ` - ${educator.country}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {educator.subjects.slice(0, 2).map((subject) => (
                                <Badge key={subject} variant="primary" className="text-[11px]">
                                  {subject}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Example of how educator discovery appears on VistaTeacher.</p>
                  <div className="grid gap-3">
                    <PreviewExampleCard />
                    <PreviewExampleCard />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="app-container py-12 sm:py-16">
          <Section title="Who are you looking to connect with?" description="Choose your starting point and explore educators who match your professional goals.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {intentCards.map((card) => (
                <Link key={card.title} href={card.href} className="focus-ring block">
                  <Card variant="interactive" padding="md" className="h-full">
                    <p className="type-meta text-primary-800">{card.marker}</p>
                    <h3 className="type-card-title mt-3 text-base text-foreground">{card.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{card.description}</p>
                    <p className="mt-4 text-sm font-semibold text-primary-800">Explore Discover</p>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>
        </section>

        <section className="app-container py-4 sm:py-8">
          <Section
            title="Meet educators who understand your work"
            description="Discover profiles by subject, grade level, location, and professional focus areas."
            action={
              <Link href="/educators" className="focus-ring rounded-md text-sm font-semibold text-primary-800 hover:underline">
                Explore All Educators
              </Link>
            }
          >
            {previewLoading ? (
              <ListSkeleton rows={3} />
            ) : previewError ? (
              <ErrorState
                message="We could not load educator previews right now. You can still explore Discover."
                onRetry={() => window.location.reload()}
              />
            ) : previewEducators.length === 0 ? (
              <EmptyState
                title="VistaTeacher is growing"
                description="Create your profile and help shape the educator network."
                actionLabel={isAuthenticated ? "Complete Your Profile" : "Create Your Profile"}
                onAction={() => {
                  window.location.assign(isAuthenticated ? "/profile/edit" : "/auth/signup");
                }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {previewEducators.map((educator) => (
                  <Link
                    key={educator.uid}
                    href={`/educators/${educator.uid}`}
                    className="focus-ring block"
                    onClick={() => trackHomepageAction("preview_profile_open")}
                  >
                    <Card variant="profile" padding="md" className="h-full">
                      <div className="flex items-start gap-3">
                        <Avatar src={educator.photoURL} alt={educator.displayName} size="md" />
                        <div className="min-w-0">
                          <h3 className="type-card-title truncate text-base text-foreground">{educator.displayName}</h3>
                          <p className="mt-1 text-sm text-text-secondary">
                            {educator.gradeLevel || "Educator"}
                            {educator.country ? ` - ${educator.country}` : ""}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm text-text-muted">
                            {(educator.bio || "Professional educator profile on VistaTeacher.").trim()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {educator.subjects.slice(0, 3).map((subject) => (
                          <Badge key={subject} variant="primary" className="text-[11px]">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </section>

        <section className="app-container py-12 sm:py-14">
          <Section title="How VistaTeacher works" description="Discover -> Connect -> Collaborate">
            <div className="grid gap-4 md:grid-cols-3">
              <Card variant="standard" padding="md">
                <h3 className="type-card-title text-lg text-foreground">Discover</h3>
                <p className="mt-2 text-sm text-text-secondary">Find educators who share your professional world.</p>
              </Card>
              <Card variant="standard" padding="md">
                <h3 className="type-card-title text-lg text-foreground">Connect</h3>
                <p className="mt-2 text-sm text-text-secondary">Build meaningful relationships with educators who understand your work.</p>
              </Card>
              <Card variant="standard" padding="md">
                <h3 className="type-card-title text-lg text-foreground">Collaborate</h3>
                <p className="mt-2 text-sm text-text-secondary">Exchange ideas, resources, support, and opportunities.</p>
              </Card>
            </div>
            <p className="text-sm text-text-secondary">
              Start discovering and following educators today. Professional connection tools are being expanded.
            </p>
          </Section>
        </section>

        <section className="app-container py-4 sm:py-8">
          <Section title="Supporting tools for your professional network" description="Communities, resources, and creation tools support the people-first experience.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ecosystemCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="focus-ring block"
                  onClick={() => {
                    if (card.event) trackHomepageAction(card.event);
                  }}
                >
                  <Card variant="resource" padding="md" className="h-full">
                    <h3 className="type-card-title text-base text-foreground">{card.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{card.description}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>
        </section>

        <section className="app-container py-12 sm:py-14">
          <Section title="Why educators choose VistaTeacher" description="A dedicated professional space focused on educator relationships and growth.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card variant="compact" className="p-4 text-sm text-text-secondary">Find people beyond your own school and district.</Card>
              <Card variant="compact" className="p-4 text-sm text-text-secondary">Connect around subjects and grade-level realities.</Card>
              <Card variant="compact" className="p-4 text-sm text-text-secondary">Reduce professional isolation through global peer learning.</Card>
              <Card variant="compact" className="p-4 text-sm text-text-secondary">Build a visible professional identity over time.</Card>
            </div>
          </Section>
        </section>

        <section className="app-container py-4 sm:py-8">
          <Section title="Trust and privacy" description="Clear principles, transparent policies, and educator-first ownership.">
            <div className="grid gap-4 md:grid-cols-3">
              <Card variant="standard" padding="md">
                <h3 className="type-card-title text-base text-foreground">You keep ownership</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Educators retain ownership of lesson plans, resources, and other original content.
                </p>
                <Link href="/terms#content-ownership" className="focus-ring mt-3 inline-block text-sm font-semibold text-primary-800 hover:underline">
                  View terms
                </Link>
              </Card>
              <Card variant="standard" padding="md">
                <h3 className="type-card-title text-base text-foreground">Data is not sold</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  VistaTeacher does not sell personal data to third parties.
                </p>
                <Link href="/privacy" className="focus-ring mt-3 inline-block text-sm font-semibold text-primary-800 hover:underline">
                  Read privacy policy
                </Link>
              </Card>
              <Card variant="standard" padding="md">
                <h3 className="type-card-title text-base text-foreground">You manage your profile</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  You can update or remove your account details through your account settings.
                </p>
                <Link href="/account" className="focus-ring mt-3 inline-block text-sm font-semibold text-primary-800 hover:underline">
                  Account management
                </Link>
              </Card>
            </div>
          </Section>
        </section>

        <section className="app-container py-14 sm:py-16">
          <div className="surface-panel rounded-2xl bg-linear-to-r from-primary-900 via-primary-800 to-primary-700 px-6 py-10 text-center text-white sm:px-10">
            <h2 className="type-page-title text-3xl text-white sm:text-4xl">
              Your next professional connection is out there.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Create your free VistaTeacher profile and start discovering educators who share your professional world.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={finalCta.href}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600"
                onClick={() => trackHomepageAction("final_primary_cta")}
              >
                {finalCta.label}
              </Link>
              <Link
                href="/educators"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-white/55 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => trackHomepageAction("final_secondary_cta")}
              >
                Explore Educators
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
