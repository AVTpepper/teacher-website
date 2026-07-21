export default function CookiesPage() {
  const lastUpdated = "May 12, 2026";
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
        <p className="mt-2 text-xs text-muted">Last updated: {lastUpdated}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">What Are Cookies?</h2>
        <p className="text-muted leading-relaxed">Cookies are small text files placed on your device by websites you visit. They are widely used to make websites work more efficiently and provide information to the site owners.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">How We Use Cookies</h2>
        <ul className="space-y-2 text-muted">
          <li className="flex items-start gap-2">
            <span className="text-primary-900 font-bold mt-0.5">•</span>
            <span><strong className="text-foreground">Authentication</strong>: We use Firebase Authentication, which sets session cookies to keep you logged in.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-900 font-bold mt-0.5">•</span>
            <span><strong className="text-foreground">Preferences</strong>: We may store lightweight preferences (such as theme settings) in your browser&apos;s local storage.</span>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Third-Party Cookies</h2>
        <p className="text-muted leading-relaxed">We use Google Firebase services, which may set their own cookies. Please refer to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-900 hover:underline">Google&apos;s Privacy Policy</a> for details.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Managing Cookies</h2>
        <p className="text-muted leading-relaxed">You can control cookies through your browser settings. Note that disabling cookies may affect your ability to log in and use VistaTeacher.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p className="text-muted leading-relaxed">Questions about our use of cookies? <a href="/contact" className="text-primary-900 hover:underline">Contact us</a>.</p>
      </section>
    </div>
  );
}
