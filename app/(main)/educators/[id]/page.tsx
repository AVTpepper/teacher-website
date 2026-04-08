export default function EducatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Educator Profile</h1>
      <p className="mt-2 text-sm text-muted">
        Educator details, posts, resources, and achievements.
      </p>
    </div>
  );
}
