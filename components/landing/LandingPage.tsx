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
      "Design rich, structured lesson plans with objectives, materials, and step-by-step activities — all in one place.",
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

const liveExamples = [
  {
    title: "Trending Discussions",
    description:
      "See the same live discussion stream educators use daily to swap ideas, ask classroom questions, and share quick wins.",
    href: "/forums",
    cta: "Join discussions",
    tag: "Forums",
  },
  {
    title: "Latest Resources",
    description:
      "Browse the current resource library, including worksheets, activities, and classroom-ready materials shared by the community.",
    href: "/resources",
    cta: "Browse resources",
    tag: "Resource Library",
  },
  {
    title: "Featured Lessons",
    description:
      "Open real lesson drafts and published plans, then remix structure, pacing, and activities in your own classroom workflow.",
    href: "/lesson-builder",
    cta: "Explore lessons",
    tag: "Lesson Builder",
  },
  {
    title: "Inspiration Picks",
    description:
      "Discover curated videos, articles, and stories teachers are using right now to spark engagement and new approaches.",
    href: "/inspiration",
    cta: "View inspiration",
    tag: "Inspiration",
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
            VistaTeacher
          </p>

          <h1
            id="hero-heading"
            className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl"
          >
            Built for educators who plan boldly,
            <span className="text-accent-400"> share generously</span>, and grow together.
          </h1>

          <p className="mt-6 mx-auto max-w-xl text-lg text-white/80 leading-relaxed">
            Plan better lessons, share resources, swap ideas, and build a classroom community with confidence.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-lg bg-accent-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-h-11 min-w-11"
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

          <p className="mt-5 text-sm text-white/80">
            Start on the <span className="font-semibold text-white">Free</span> plan and upgrade to
            <span className="font-semibold text-white"> Plus</span> for expanded AI-powered lesson workflows.
          </p>
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
              From first-draft lesson plans to professional connections —
              VistaTeacher has you covered.
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

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section
        className="bg-secondary-50 py-16 sm:py-20"
        aria-labelledby="plans-heading"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2
              id="plans-heading"
              className="text-3xl font-bold text-foreground sm:text-4xl"
            >
              Plans that grow with your teaching
            </h2>
            <p className="mt-4 text-base text-muted max-w-2xl mx-auto">
              Start free and move to Plus when you want deeper AI-assisted planning and faster workflow support.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-900">Free</p>
              <h3 className="mt-2 text-xl font-bold text-foreground">Great for getting started</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
                <li>Build and publish lesson plans</li>
                <li>Share resources and participate in forums</li>
                <li>Access core AI planning tools</li>
              </ul>
            </article>

            <article className="rounded-xl border border-accent-200 bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">Plus</p>
              <h3 className="mt-2 text-xl font-bold text-foreground">For high-volume planners</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
                <li>Expanded AI generation capacity</li>
                <li>More advanced refine and planning support</li>
                <li>Built for teams and power users</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ── Real Examples ────────────────────────────────────────────────── */}
      <section
        className="bg-background py-16 sm:py-20"
        aria-labelledby="social-proof-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              id="social-proof-heading"
              className="text-3xl font-bold text-foreground sm:text-4xl"
            >
              Real examples from VistaTeacher
            </h2>
            <p className="mt-4 text-base text-muted max-w-xl mx-auto">
              Explore live sections used across the platform right now, from active discussions to featured lessons.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {liveExamples.map((example) => (
              <article
                key={example.title}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-900">
                  {example.tag}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {example.title}
                </h3>
                <p className="mt-3 text-sm text-muted leading-relaxed">
                  {example.description}
                </p>
                <Link
                  href={example.href}
                  className="mt-4 inline-flex items-center text-sm font-semibold text-primary-900 hover:text-primary-800"
                >
                  {example.cta} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
