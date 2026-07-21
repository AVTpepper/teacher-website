import Link from "next/link";

export default function IPNotice() {
  return (
    <aside
      aria-label="Intellectual property notice"
      className="flex items-start gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-xs text-muted"
    >
      <svg
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
        />
      </svg>
      <p>
        The content shared by educators on VistaTeacher remains the intellectual
        property of its author.{" "}
        <Link
          href="/terms#content-ownership"
          className="underline hover:text-foreground transition-colors"
          aria-label="Read our Terms of Service on content ownership"
        >
          Learn more
        </Link>
        .
      </p>
    </aside>
  );
}
