import Link from "next/link";
import { Button } from "@/components/ui";

export default function CareersPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Careers</h1>
        <p className="mt-3 text-muted text-base leading-relaxed">
          Help us build the best professional community for educators. We&apos;re a small, passionate team working to make a real difference in education.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-secondary-50 p-10 text-center">
        <p className="text-4xl mb-3">🚀</p>
        <h2 className="text-lg font-semibold text-foreground">No Open Positions Right Now</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          We don&apos;t have any open roles at the moment, but we&apos;re always interested in meeting passionate people. Send us a note and we&apos;ll keep you in mind.
        </p>
        <div className="mt-5">
          <Link href="/contact">
            <Button variant="primary">Get in Touch</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
