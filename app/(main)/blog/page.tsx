export default function BlogPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Blog</h1>
        <p className="mt-3 text-muted text-base leading-relaxed">
          Tips, stories, and updates from the EduConnect team and educator community.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-secondary-50 p-10 text-center">
        <p className="text-4xl mb-3">📝</p>
        <h2 className="text-lg font-semibold text-foreground">Coming Soon</h2>
        <p className="text-sm text-muted mt-2">
          Our blog is on its way. Check back soon for articles, educator spotlights, and platform updates.
        </p>
      </div>
    </div>
  );
}
