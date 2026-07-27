import Link from "next/link";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card } from "@/components/ui";

export default function AboutPage() {
  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        eyebrow="About"
        title="A professional network designed for educators"
        subtitle="VistaTeacher is built to reduce professional isolation and help educators find people, ideas, and opportunities that genuinely move their work forward."
      />

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Our mission</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We&apos;re building a dedicated space where educators can share resources, discuss real classroom challenges, discover job opportunities, and stay inspired without getting buried in generic social noise.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Why this exists</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Great teachers are often doing serious work in isolation. VistaTeacher gives that work a clearer home: professional identity, meaningful discovery, practical collaboration, and tools that support the day-to-day reality of education.
            </p>
          </div>
        </Card>

        <Card padding="lg" className="space-y-4 border-primary-100 bg-primary-50/40">
          <h2 className="text-lg font-semibold text-foreground">What members can do</h2>
          <ul className="space-y-3 text-sm text-muted">
            <li>Build a visible educator profile with subject, grade-level, and professional context.</li>
            <li>Discover peer educators, lesson plans, resources, discussions, and inspiration.</li>
            <li>Connect, message, and grow a professional network around real practice.</li>
            <li>Use AI-supported lesson workflows and stronger network tools with Plus.</li>
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card padding="lg">
          <h3 className="text-base font-semibold text-foreground">Community Feed</h3>
          <p className="mt-2 text-sm text-muted">Share ideas, reflections, and useful classroom wins with other educators.</p>
        </Card>
        <Card padding="lg">
          <h3 className="text-base font-semibold text-foreground">Lesson Builder</h3>
          <p className="mt-2 text-sm text-muted">Create, refine, remix, and publish lesson plans that others can learn from.</p>
        </Card>
        <Card padding="lg">
          <h3 className="text-base font-semibold text-foreground">Resource Library</h3>
          <p className="mt-2 text-sm text-muted">Discover teaching materials and practical assets from fellow educators.</p>
        </Card>
        <Card padding="lg">
          <h3 className="text-base font-semibold text-foreground">Forums</h3>
          <p className="mt-2 text-sm text-muted">Join topic-focused discussions organised around real educator needs.</p>
        </Card>
        <Card padding="lg">
          <h3 className="text-base font-semibold text-foreground">Job Board</h3>
          <p className="mt-2 text-sm text-muted">Track opportunities across teaching and the wider education space.</p>
        </Card>
        <Card padding="lg">
          <h3 className="text-base font-semibold text-foreground">Inspiration Hub</h3>
          <p className="mt-2 text-sm text-muted">Keep a steady flow of useful articles, videos, and educator stories.</p>
        </Card>
      </section>

      <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Get in touch</h2>
          <p className="mt-1 text-sm text-muted">Have feedback, partnership ideas, or questions about the platform? We&apos;d like to hear it.</p>
        </div>
        <Link href="/contact">
          <Button variant="primary">Contact Us</Button>
        </Link>
      </Card>
    </div>
  );
}
