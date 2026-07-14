export default function BlogPage() {
  return (
    <div className="pb-12 space-y-8">
      <div className="-mx-4 -mt-4 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Insights</p>
        <h1 className="mt-1 text-3xl font-bold">Blog</h1>
        <p className="mt-2 text-primary-100/90 text-base leading-relaxed max-w-3xl">
          Tips, stories, and updates from the EduConnect team and educator community.
        </p>
      </div>

      <div className="max-w-3xl mx-auto rounded-xl border border-dashed border-border bg-secondary-50 p-10 text-center">
        <p className="text-4xl mb-3">📝</p>
        <h2 className="text-lg font-semibold text-foreground">Coming Soon</h2>
        <p className="text-sm text-muted mt-2">
          Our blog is on its way. Check back soon for articles, educator spotlights, and platform updates.
        </p>
      </div>
    </div>
  );
}
