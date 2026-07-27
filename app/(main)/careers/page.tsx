import Link from "next/link";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card } from "@/components/ui";

export default function CareersPage() {
  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        eyebrow="Careers"
        title="Help build a better professional space for educators"
        subtitle="VistaTeacher is focused on reducing professional isolation and making educator collaboration more practical, visible, and useful."
      />

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">How we think about hiring</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We care about thoughtful product work, strong execution, and people who take educators seriously as professionals. That means clear reasoning, practical design, and a willingness to improve the details that shape trust.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">What we value</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Good judgment, useful systems, clean interfaces, and respect for the realities of schools and teaching. Small teams have to care about craft.
            </p>
          </div>
        </Card>

        <Card padding="lg" className="border-dashed border-border bg-secondary-50/80 text-center">
          <p className="mb-3 text-4xl">🚀</p>
          <h2 className="text-lg font-semibold text-foreground">No open positions right now</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            We do not have active roles listed at the moment, but we are always open to hearing from people who care deeply about education and product quality.
          </p>
          <div className="mt-5">
            <Link href="/contact">
              <Button variant="primary">Get in Touch</Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
