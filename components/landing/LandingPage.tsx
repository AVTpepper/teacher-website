import Link from "next/link";
import Footer from "@/components/layout/Footer";
import {
  BookOpen,
  Sparkles,
  MessageSquare,
  FolderOpen,
  Users,
} from "lucide-react";

// ─── Feature data ────────────────────────────────────────────────────────────

const features = [
  {
    Icon: BookOpen,
    title: "Lesson Builder",
    description:
      "Design rich, structured lesson plans with objectives, materials, and guided activities in one place.",
  },
  {
    Icon: Sparkles,
    title: "AI Assistant",
    description:
      "Generate a complete lesson plan from a single topic prompt, or get targeted suggestions for any section in seconds.",
  },
  {
    Icon: MessageSquare,
    title: "Forums",
    description:
      "Ask questions, swap strategies, and connect with educators who truly understand the classroom.",
  },
  {
    Icon: FolderOpen,
    title: "Resource Library",
    description:
      "Upload, discover, and share worksheets, slide decks, and teaching materials with the whole community.",
  },
  {
    Icon: Users,
    title: "Community",
    description:
      "Follow educators you admire, bookmark their best work, and build a professional learning network.",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative bg-primary-900 text-white"
        aria-labelledby="hero-heading"
      >
        {/* Subtle warm-tinted gradient overlay */}
        <div
          className="absolute inset-0 bg-linear-to-br from-primary-950 via-primary-900 to-primary-800 opacity-90"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28 lg:py-36 text-center">
          <p className="mb-4 text-sm font-semibold tracking-widest uppercase text-accent-300">
            Welcome to EduConnect
          </p>

          <h1
            id="hero-heading"
            className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl"
          >
            Where Great Teachers{" "}
            <span className="text-accent-400">Connect</span>
          </h1>

          <p className="mt-6 mx-auto max-w-xl text-lg text-white/80 leading-relaxed">
            Plan better lessons, share resources, swap ideas, and grow
            alongside a community of educators who love what they do.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-primary-900 shadow-sm transition-colors hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-h-11 min-w-11"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/70 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-h-11 min-w-11"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section
        className="bg-background py-16 sm:py-20"
        aria-labelledby="features-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              id="features-heading"
              className="text-3xl font-bold text-foreground sm:text-4xl"
            >
              Everything you need, in one place
            </h2>
            <p className="mt-4 text-base text-muted max-w-xl mx-auto">
              From early lesson plan drafts to professional connections,
              EduConnect has you covered.
            </p>
          </div>

          <ul
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            role="list"
          >
            {features.map(({ Icon, title, description }) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div
                  className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-900"
                  aria-hidden="true"
                >
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Social Proof ─────────────────────────────────────────────────── */}
      <section
        className="bg-secondary-50 py-16 sm:py-20"
        aria-labelledby="social-proof-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              id="social-proof-heading"
              className="text-3xl font-bold text-foreground sm:text-4xl"
            >
              See what educators are sharing
            </h2>
            <p className="mt-4 text-base text-muted max-w-xl mx-auto">
              Real lesson plans, discussions, and resources created by
              teachers just like you.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Sample: Lesson Plan Card */}
            <div
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              aria-label="Sample lesson plan: Introduction to Fractions"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0 text-sm font-bold text-primary-900"
                    aria-hidden="true"
                  >
                    S
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Sarah Mitchell
                    </p>
                    <p className="text-xs text-muted">2 days ago</p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-info-50 px-2.5 py-0.5 text-xs font-medium text-info-700">
                  Lesson Plan
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Introduction to Fractions
              </h3>
              <div className="flex gap-2 flex-wrap mb-3">
                <span className="inline-flex items-center rounded-md bg-secondary-100 px-2 py-0.5 text-xs text-secondary-700">
                  Grade 4
                </span>
                <span className="inline-flex items-center rounded-md bg-secondary-100 px-2 py-0.5 text-xs text-secondary-700">
                  Math
                </span>
              </div>
              <p className="text-sm text-muted line-clamp-2">
                A hands-on introduction to fractions using fraction tiles and
                real-world examples. Students explore halves, thirds, and
                quarters through guided discovery activities.
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span>❤️ 24 likes</span>
                <span>💬 6 comments</span>
              </div>
            </div>

            {/* Sample: Forum Post Card */}
            <div
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              aria-label="Sample forum post: Tips for classroom management"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-9 w-9 rounded-full bg-accent-100 flex items-center justify-center shrink-0 text-sm font-bold text-accent-800"
                    aria-hidden="true"
                  >
                    J
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      James Okafor
                    </p>
                    <p className="text-xs text-muted">5 hours ago</p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700">
                  💬 Discussion
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Tips for classroom management in mixed-ability groups
              </h3>
              <p className="text-sm text-muted line-clamp-3">
                I&apos;ve been experimenting with flexible seating and collaborative
                roles in my Year 6 class. Would love to hear what strategies
                others have found effective for keeping everyone engaged when
                abilities vary so widely.
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span>❤️ 17 likes</span>
                <span>💬 14 comments</span>
              </div>
            </div>

            {/* Sample: Resource Card */}
            <div
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              aria-label="Sample resource: Phonics Worksheet Pack"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-9 w-9 rounded-full bg-success-50 flex items-center justify-center shrink-0 text-sm font-bold text-success-700"
                    aria-hidden="true"
                  >
                    R
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Rachel Tan
                    </p>
                    <p className="text-xs text-muted">1 week ago</p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">
                  📚 Resource
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Phonics Worksheet Pack: Blends &amp; Digraphs
              </h3>
              <div className="flex gap-2 flex-wrap mb-3">
                <span className="inline-flex items-center rounded-md bg-secondary-100 px-2 py-0.5 text-xs text-secondary-700">
                  Grade 1 to 2
                </span>
                <span className="inline-flex items-center rounded-md bg-secondary-100 px-2 py-0.5 text-xs text-secondary-700">
                  English / Literacy
                </span>
              </div>
              <p className="text-sm text-muted line-clamp-2">
                20 printable worksheets covering common blends (bl, cl, fl)
                and digraphs (sh, ch, th). Includes answer keys and a
                suggested teaching sequence.
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span>⭐ 4.8 / 5</span>
                <span>📥 312 downloads</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
