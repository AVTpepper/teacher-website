import Link from "next/link";

interface MentionUser {
  uid: string;
  displayName: string;
}

interface MentionRendererProps {
  text: string;
  mentionedUsers?: MentionUser[];
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders plain text with @mention tokens converted to educator profile links.
 * Unresolved mentions (no matching user in mentionedUsers) are styled but not linked.
 */
export default function MentionRenderer({ text, mentionedUsers }: MentionRendererProps) {
  if (!mentionedUsers?.length) return <>{text}</>;

  // Sort longest name first to avoid partial matches
  const sorted = [...mentionedUsers].sort((a, b) => b.displayName.length - a.displayName.length);
  const pattern = sorted.map((u) => `@${escapeRegex(u.displayName)}`).join("|");
  const regex = new RegExp(`(${pattern})`, "g");
  const segments = text.split(regex);

  return (
    <>
      {segments.map((seg, i) => {
        const match = sorted.find((u) => seg === `@${u.displayName}`);
        if (match) {
          return (
            <Link
              key={i}
              href={`/educators/${match.uid}`}
              className="text-primary-900 font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {seg}
            </Link>
          );
        }
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}
