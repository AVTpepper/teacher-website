import Badge from "./Badge";

export function ProfessionalTitle({ title }: { title?: string | null }) {
  if (!title) return null;
  return <p className="text-sm font-medium text-text-secondary truncate">{title}</p>;
}

export function LocationMeta({ country, school }: { country?: string | null; school?: string | null }) {
  const value = [school, country].filter(Boolean).join(" · ");
  if (!value) return null;
  return <p className="type-meta text-text-muted truncate">{value}</p>;
}

export function SubjectTags({ values }: { values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge key={value} variant="primary" className="text-[11px]">
          {value}
        </Badge>
      ))}
    </div>
  );
}

export function TierBadge({ tier }: { tier?: "free" | "plus" | string | null }) {
  if (!tier) return null;
  if (tier !== "plus") {
    return <Badge variant="default">Free</Badge>;
  }
  return <Badge variant="warning">Plus</Badge>;
}

export function VerificationBadge({ verified }: { verified?: boolean }) {
  if (!verified) return null;
  return <Badge variant="info">Verified Educator</Badge>;
}
