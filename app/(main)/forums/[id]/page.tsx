export default function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Discussion Thread</h1>
      <p className="mt-2 text-sm text-muted">
        Thread details, comments, and replies.
      </p>
    </div>
  );
}
