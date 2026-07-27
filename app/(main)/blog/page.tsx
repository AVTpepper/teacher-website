import Link from "next/link";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card } from "@/components/ui";

export default function BlogPage() {
  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        eyebrow="Blog"
        title="Updates, essays, and practical stories from VistaTeacher"
        subtitle="This will be the home for product updates, educator spotlights, and writing about how professional networks can better serve teaching practice."
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">What will appear here</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Expect platform updates, product decisions, educator interviews, and posts that explain how VistaTeacher is evolving. The goal is useful signal, not filler.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Why wait before publishing</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              It is better to launch a small archive of meaningful posts than a placeholder stream of generic content. We will publish when there is something worth reading.
            </p>
          </div>
        </Card>

        <Card padding="lg" className="border-dashed border-border bg-secondary-50/80 text-center">
          <p className="mb-3 text-4xl">📝</p>
          <h2 className="text-lg font-semibold text-foreground">Coming soon</h2>
          <p className="mt-2 text-sm text-muted">
            The first posts are being prepared now. Check back soon for articles, educator spotlights, and product notes.
          </p>
          <div className="mt-5">
            <Link href="/contact">
              <Button variant="outline">Contact the team</Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
