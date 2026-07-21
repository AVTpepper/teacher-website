import Link from "next/link";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card, Badge } from "@/components/ui";

const comparisonRows = [
  {
    feature: "Profile, posting, and community access",
    free: "Included",
    plus: "Included",
  },
  {
    feature: "Lesson Builder and resource sharing",
    free: "Included",
    plus: "Included",
  },
  {
    feature: "AI lesson generation limits",
    free: "Standard daily and monthly limits",
    plus: "Expanded limits",
  },
  {
    feature: "Account badge",
    free: "Standard account",
    plus: "Fancy Plus badge",
  },
  {
    feature: "Advanced planning workflow support",
    free: "Core workflow",
    plus: "Expanded workflow support",
  },
];

export default function AccountPlansPage() {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href="/account" className="hover:text-foreground transition-colors">
            Account
          </Link>
          <span>/</span>
          <span className="text-foreground">Plans</span>
        </div>
        <Link href="/account">
          <Button variant="outline" size="sm">Back</Button>
        </Link>
      </div>

      <DiscoveryShell
        eyebrow="Plans"
        title="Free vs Plus"
        subtitle="Compare what is included and choose the plan that fits your teaching workflow."
        className="mb-0"
      />

      <Card padding="lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Free</h2>
              <Badge variant="default">Current starter plan</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              Great for getting started with lesson planning, community sharing, and core AI tools.
            </p>
          </div>

          <div className="rounded-xl border border-accent-300 bg-accent-50/40 p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Plus</h2>
              <Badge variant="success">Fancy badge + expanded AI</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              Best for educators who want expanded AI workflows and higher planning capacity.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0">
            <caption className="sr-only">Plan comparison table</caption>
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-primary-900">
                  Feature
                </th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-primary-900">
                  Free
                </th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-primary-900">
                  Plus
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature}>
                  <td className="border-b border-border/70 px-3 py-3 text-sm text-foreground">{row.feature}</td>
                  <td className="border-b border-border/70 px-3 py-3 text-sm text-muted">{row.free}</td>
                  <td className="border-b border-border/70 px-3 py-3 text-sm text-muted">{row.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/account/upgrade">
            <Button>Upgrade to Plus</Button>
          </Link>
          <Link href="/account">
            <Button variant="outline">Manage Account</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
