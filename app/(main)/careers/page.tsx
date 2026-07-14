import Link from "next/link";
import { Button } from "@/components/ui";

export default function CareersPage() {
  return (
    <div className="pb-12 space-y-10">
      <div className="-mx-4 -mt-4 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Join The Team</p>
        <h1 className="mt-1 text-3xl font-bold">Careers</h1>
        <p className="mt-2 text-primary-100/90 text-base leading-relaxed max-w-3xl">
          Help us build the best professional community for educators. We're a small, passionate team working to make a real difference in education.
        </p>
      </div>

      <div className="max-w-3xl mx-auto rounded-xl border border-dashed border-border bg-secondary-50 p-10 text-center">
        <p className="text-4xl mb-3">🚀</p>
        <h2 className="text-lg font-semibold text-foreground">No Open Positions Right Now</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          We don't have any open roles at the moment, but we're always interested in meeting passionate people. Send us a note and we'll keep you in mind.
        </p>
        <div className="mt-5">
          <Link href="/contact">
            <Button variant="secondary">Get in Touch</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
