import Link from "next/link";
import Card from "./Card";

interface SearchResultCardProps {
  href: string;
  title: string;
  subtitle: string;
  icon: string;
  badges?: React.ReactNode;
}

export default function SearchResultCard({
  href,
  title,
  subtitle,
  icon,
  badges,
}: SearchResultCardProps) {
  return (
    <Link href={href} className="block group">
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="type-body-medium font-semibold text-foreground group-hover:underline truncate">
              {title}
            </p>
            <p className="type-body-light text-xs text-muted mt-0.5">{subtitle}</p>
            {badges && <div className="flex gap-2 mt-2">{badges}</div>}
          </div>
          <span className="text-2xl shrink-0">{icon}</span>
        </div>
      </Card>
    </Link>
  );
}
