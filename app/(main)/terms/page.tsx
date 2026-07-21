export default function TermsPage() {
  const lastUpdated = "May 12, 2026";
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-xs text-muted">Last updated: {lastUpdated}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
        <p className="text-muted leading-relaxed">By accessing or using VistaTeacher, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">2. User Conduct</h2>
        <p className="text-muted leading-relaxed">You agree to use VistaTeacher only for lawful purposes and in a manner that does not infringe the rights of others. You may not post content that is harmful, hateful, or violates any applicable law.</p>
      </section>

      <section id="content-ownership" className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">3. Content Ownership</h2>
        <p className="text-muted leading-relaxed">Educators retain full intellectual property ownership of all lesson plans, resources, inspiration posts, and other content they publish on VistaTeacher. By posting content, you grant VistaTeacher a non-exclusive, royalty-free licence to display and distribute it to other users on the platform solely for the purpose of operating the service. This licence does not transfer ownership and may be revoked by deleting the content from your account.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">4. Account Termination</h2>
        <p className="text-muted leading-relaxed">We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting us.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">5. Disclaimers</h2>
        <p className="text-muted leading-relaxed">VistaTeacher is provided &quot;as is&quot; without warranties of any kind. We are not responsible for the accuracy of user-generated content.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">6. Changes to Terms</h2>
        <p className="text-muted leading-relaxed">We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
        <p className="text-muted leading-relaxed">Questions about these terms? <a href="/contact" className="text-primary-900 hover:underline">Contact us</a>.</p>
      </section>
    </div>
  );
}
