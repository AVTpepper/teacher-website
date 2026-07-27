"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Globe,
  Handshake,
  Lightbulb,
  Lock,
  Map,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  UserRoundSearch,
} from "lucide-react";
import {
  Badge,
  Card,
  ErrorState,
  ListSkeleton,
  Section,
} from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import Footer from "@/components/layout/Footer";
import PublicNavbar from "@/components/layout/PublicNavbar";
import { useAuth } from "@/lib/auth-context";

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
  professionalRole?: string;
  country?: string;
  bio?: string;
}

interface PublicShowcaseApiResponse {
  educators?: PublicEducatorPreview[];
  evidence?: {
    items?: Array<{
      id: string;
      kind: "discussion" | "inspiration";
      title: string;
      subtitle: string;
      href: string;
    }>;
  };
}

interface PublicEvidenceItem {
  id: string;
  kind: "discussion" | "inspiration";
  title: string;
  subtitle: string;
  href: string;
}

const intentCards = [
  {
    title: "Teachers in your subject",
    description: "Swap ideas with people teaching the same content and classroom realities.",
    icon: UserRoundSearch,
  },
  {
    title: "International educators",
    description: "Compare approaches from different school systems and teaching cultures.",
    icon: Globe,
  },
  {
    title: "Collaborators",
    description: "Find partners for planning, projects, and long-term professional growth.",
    icon: Handshake,
  },
  {
    title: "Mentors",
    description: "Learn from experienced educators who can support your next career step.",
    icon: UserCheck,
  },
  {
    title: "Education professionals",
    description: "Connect beyond classroom roles across curriculum, leadership, and support teams.",
    icon: Users,
  },
];

const ecosystemCards = [
  {
    title: "Forum",
    description: "Join forum posts about shared challenges and practical ideas with educators.",
    icon: Users,
  },
  {
    title: "Resources",
    description: "Discover and share teaching materials that save planning time.",
    icon: BookOpen,
  },
  {
    title: "Lesson Builder",
    description: "Create and refine lesson plans with structured workflows.",
    icon: NotebookPen,
  },
  {
    title: "Jobs",
    description: "Explore teaching and education opportunities.",
    icon: Compass,
  },
  {
    title: "Inspiration",
    description: "Read educator stories, ideas, and professional reflections.",
    icon: Lightbulb,
  },
];

const evidenceKindIcons: Record<PublicEvidenceItem["kind"], LucideIcon> = {
  discussion: Users,
  inspiration: Sparkles,
};

function mapEducatorPreview(profile: PublicEducatorPreview): PublicEducatorPreview {
  return {
    uid: profile.uid,
    displayName: profile.displayName,
    photoURL: profile.photoURL ?? null,
    gradeLevel: profile.gradeLevel,
    subjects: profile.subjects ?? [],
    professionalRole: profile.professionalRole,
    country: profile.country,
    bio: profile.bio,
  };
}

export default function LandingPage() {
  const { user } = useAuth();
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [previewEducators, setPreviewEducators] = useState<PublicEducatorPreview[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<PublicEvidenceItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(false);

      try {
        const response = await fetch("/api/public/showcase", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as PublicShowcaseApiResponse;
        if (!response.ok) {
          throw new Error("Failed to load featured educators");
        }
        if (cancelled) return;

        const topProfiles = (payload.educators ?? [])
          .filter((profile) => profile.displayName && profile.uid)
          .slice(0, 6)
          .map(mapEducatorPreview);

        const payloadItems = payload.evidence?.items ?? [];
        setEvidenceItems(
          payloadItems
            .filter((item) => item && item.id && item.title && item.href)
            .slice(0, 6)
        );

        setPreviewEducators(topProfiles);
      } catch {
        if (!cancelled) {
          setPreviewEducators([]);
          setEvidenceItems([]);
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
    : { label: "Create Your Profile", href: "/auth/signup" };
  const finalCta = isAuthenticated
    ? { label: "Explore Your Network", href: "/educators" }
    : { label: "Create Your Profile", href: "/auth/signup" };

  return (
    <div className="flex min-h-screen flex-col bg-page-background text-text-primary">
      <PublicNavbar />

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
                  <UserCheck className="mr-2 h-4 w-4" />
                  {primaryHeroCta.label}
                </Link>
                <Link
                  href="/pricing"
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-white/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  onClick={() => trackHomepageAction("hero_secondary_cta")}
                >
                  <Map className="mr-2 h-4 w-4" />
                  View Plans
                </Link>
              </div>

              <p className="mt-4 text-sm text-white/80">Built specifically for educators.</p>
            </div>

            <div className="space-y-3">
              {previewLoading ? (
                <ListSkeleton rows={3} />
              ) : previewEducators.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {previewEducators.slice(0, 3).map((educator) => (
                    <Link
                      key={educator.uid}
                      href={`/educators/${educator.uid}`}
                      className="focus-ring block"
                      onClick={() => trackHomepageAction("preview_profile_open")}
                    >
                      <Card variant="profile" padding="md" className="h-full border-white/30 bg-white/95 shadow-lg shadow-primary-950/15 transition-transform hover:-translate-y-0.5">
                        <div className="flex items-start gap-3">
                          <Avatar src={educator.photoURL} alt={educator.displayName} size="md" />
                          <div className="min-w-0">
                            <p className="type-card-title truncate text-base text-foreground">{educator.displayName}</p>
                            <p className="mt-0.5 truncate text-xs text-text-secondary">
                              {educator.gradeLevel || "Educator"}
                              {educator.country ? ` - ${educator.country}` : ""}
                            </p>
                            <p className="mt-2 line-clamp-2 text-xs text-text-muted">
                              {(educator.bio || "Professional educator profile on VistaTeacher.").trim()}
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
                <Card variant="profile" padding="lg" className="border-white/30 bg-white/95">
                  <h2 className="type-card-title text-base text-foreground">Featured educator profiles</h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    This section only shows real showcased profiles. Add featured educator IDs to the public showcase config to display them here.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </section>

        <section className="app-container py-12 sm:py-14">
          <Section
            title="How VistaTeacher works"
            description="Discover people, build trusted relationships, and collaborate with purpose."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Card variant="standard" padding="md" className="group relative overflow-hidden border-primary-200 bg-linear-to-br from-white via-primary-50/80 to-secondary-50/80 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-200/40 blur-2xl" aria-hidden="true" />
                <div className="inline-flex rounded-full bg-primary-100 p-2 text-primary-800">
                  <Compass className="h-4 w-4" />
                </div>
                <h3 className="type-card-title mt-2 text-lg text-primary-900">Discover</h3>
                <p className="mt-2 text-sm text-text-secondary">Filter by subject, grade, and role to find educators who match your teaching context.</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-primary-800">Start with people like you</p>
              </Card>
              <Card variant="standard" padding="md" className="group relative overflow-hidden border-secondary-300 bg-linear-to-br from-white via-secondary-100/70 to-primary-50/70 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-secondary-300/40 blur-2xl" aria-hidden="true" />
                <div className="inline-flex rounded-full bg-secondary-100 p-2 text-secondary-800">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="type-card-title mt-2 text-lg text-primary-900">Connect</h3>
                <p className="mt-2 text-sm text-text-secondary">Follow peers, explore their work, and build a network that supports your goals.</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-primary-800">Grow a trusted circle</p>
              </Card>
              <Card variant="standard" padding="md" className="group relative overflow-hidden border-accent-200 bg-linear-to-br from-white via-accent-50/70 to-primary-50/70 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-200/40 blur-2xl" aria-hidden="true" />
                <div className="inline-flex rounded-full bg-accent-100 p-2 text-accent-700">
                  <Handshake className="h-4 w-4" />
                </div>
                <h3 className="type-card-title mt-2 text-lg text-primary-900">Collaborate</h3>
                <p className="mt-2 text-sm text-text-secondary">Turn connections into practical outcomes through forum posts, resources, and shared ideas.</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-primary-800">Turn ideas into practice</p>
              </Card>
            </div>
          </Section>
        </section>

        <section className="border-y border-primary-200/70 bg-linear-to-b from-secondary-50 to-primary-50/60">
          <div className="app-container py-12 sm:py-16">
            <Section
              title="Who are you looking to connect with?"
              description="Start with your intent. Then create your profile to unlock full educator discovery."
              action={
                <Link
                  href={isAuthenticated ? "/educators" : "/auth/signup"}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-accent-600"
                >
                  {isAuthenticated ? "Explore Educators" : "Create Free Account"}
                </Link>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {intentCards.map((card) => (
                  <Card key={card.title} variant="interactive" padding="md" className="h-full border-primary-200 bg-white/95 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary-50 p-1.5 text-primary-700">
                        <card.icon className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="type-card-title text-base text-primary-900">{card.title}</h3>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">{card.description}</p>
                  </Card>
                ))}
              </div>
            </Section>
          </div>
        </section>

        <section className="app-container py-12 sm:py-14">
          <Section
            title="Preview real profiles, forum posts, and inspiration"
            description="These are live showcased pages from VistaTeacher, available to browse before you join."
            action={
              <Link href={isAuthenticated ? "/educators" : "/auth/signup"} className="focus-ring rounded-md text-sm font-semibold text-primary-800 hover:underline">
                {isAuthenticated ? "Explore All Educators" : "Create Account to Unlock Full Discovery"}
              </Link>
            }
          >
            {previewLoading ? (
              <ListSkeleton rows={4} />
            ) : previewError ? (
              <ErrorState
                message="We could not load live previews right now. You can still create your profile and start exploring."
                onRetry={() => window.location.reload()}
              />
            ) : previewEducators.length === 0 && evidenceItems.length === 0 ? (
              <div className="space-y-4">
                <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary">
                    No featured educator profiles have been added yet.
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary">
                    No featured forum posts or inspiration posts have been added yet.
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {previewEducators.slice(0, 6).map((educator) => (
                    <Link
                      key={educator.uid}
                      href={`/educators/${educator.uid}`}
                      className="focus-ring block"
                      onClick={() => trackHomepageAction("preview_profile_open")}
                    >
                      <Card variant="profile" padding="md" className="h-full border-primary-200 bg-white shadow-md shadow-primary-100/30">
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

                <div className="space-y-3">
                  {evidenceItems.map((item) => (
                    <Link key={item.id} href={item.href} className="focus-ring block">
                      <Card variant="resource" padding="md" className="h-full border-secondary-300 bg-white/95 shadow-md shadow-secondary-200/30">
                        <div className="flex items-center gap-2 text-accent-700">
                          {(() => {
                            const EvidenceKindIcon = evidenceKindIcons[item.kind];
                            return <EvidenceKindIcon className="h-4 w-4" />;
                          })()}
                          <p className="type-meta uppercase tracking-[0.12em]">{item.kind}</p>
                        </div>
                        <h3 className="type-card-title mt-2 text-base text-foreground">{item.title}</h3>
                        <p className="mt-1 text-sm text-text-secondary">{item.subtitle}</p>
                        <p className="mt-3 inline-flex items-center text-sm font-semibold text-primary-800">
                          Open public preview
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </p>
                      </Card>
                    </Link>
                  ))}
                  {evidenceItems.length === 0 ? (
                    <Card variant="compact" className="border-secondary-300 bg-white p-4 text-sm text-text-secondary">
                      No featured forum posts or inspiration posts have been added yet.
                    </Card>
                  ) : null}
                </div>
              </div>
            )}
          </Section>
        </section>

        <section className="bg-linear-to-b from-primary-50/70 to-secondary-50/70">
          <div className="app-container py-12 sm:py-14">
            <Section title="Tools that strengthen your educator network" description="Keep your people connections active with forum posts, shared resources, planning support, and career opportunities.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ecosystemCards.map((card) => (
                  <div key={card.title} className="block">
                    <Card variant="resource" padding="md" className="h-full border-primary-200 bg-white shadow-sm hover:shadow-md">
                      <div className="inline-flex rounded-full bg-primary-50 p-2 text-primary-700">
                        <card.icon className="h-4 w-4" />
                      </div>
                      <h3 className="type-card-title text-base text-primary-900">{card.title}</h3>
                      <p className="mt-2 text-sm text-text-secondary">{card.description}</p>
                    </Card>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </section>

        <section className="app-container py-10 sm:py-12">
          <Section title="Trust and privacy" description="Your work, your profile, and your data are treated with educator-first safeguards.">
            <div className="grid gap-4 md:grid-cols-3">
              <Card variant="standard" padding="md" className="border-primary-200 bg-white shadow-sm">
                <div className="inline-flex rounded-full bg-primary-50 p-2 text-primary-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="type-card-title text-base text-primary-900">You keep ownership</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Original lesson plans, resources, and authored content remain yours.
                </p>
                <Link href="/terms#content-ownership" className="focus-ring mt-3 inline-block text-sm font-semibold text-primary-800 hover:underline">
                  View terms
                </Link>
              </Card>
              <Card variant="standard" padding="md" className="border-primary-200 bg-white shadow-sm">
                <div className="inline-flex rounded-full bg-primary-50 p-2 text-primary-700">
                  <Lock className="h-4 w-4" />
                </div>
                <h3 className="type-card-title text-base text-primary-900">Data is not sold</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Personal data is not sold to third parties.
                </p>
                <Link href="/privacy" className="focus-ring mt-3 inline-block text-sm font-semibold text-primary-800 hover:underline">
                  Read privacy policy
                </Link>
              </Card>
              <Card variant="standard" padding="md" className="border-primary-200 bg-white shadow-sm">
                <div className="inline-flex rounded-full bg-primary-50 p-2 text-primary-700">
                  <UserCheck className="h-4 w-4" />
                </div>
                <h3 className="type-card-title text-base text-primary-900">You control your profile</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Update or remove account details from your own account settings.
                </p>
                <Link href="/account" className="focus-ring mt-3 inline-block text-sm font-semibold text-primary-800 hover:underline">
                  Account management
                </Link>
              </Card>
            </div>
          </Section>
        </section>

        <section className="app-container py-14 sm:py-16">
          <div className="rounded-2xl border border-primary-700/40 bg-linear-to-r from-primary-900 via-primary-800 to-accent-700 px-6 py-10 text-center text-white shadow-xl sm:px-10">
            <h2 className="type-page-title text-3xl text-white sm:text-4xl">
              Build your educator network with people who get your work.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Create your free profile to unlock full discovery, follow educators, and stay connected to ideas that matter.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={finalCta.href}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600"
                onClick={() => trackHomepageAction("final_primary_cta")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {finalCta.label}
              </Link>
              <Link
                href="/educators"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-white/55 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => trackHomepageAction("final_secondary_cta")}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
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
