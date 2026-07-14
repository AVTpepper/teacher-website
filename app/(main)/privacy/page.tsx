export default function PrivacyPage() {
  const lastUpdated = "May 12, 2026";
  return (
    <div className="pb-12 space-y-8">
      <div className="-mx-4 -mt-4 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 sm:rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Legal</p>
        <h1 className="mt-1 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-xs text-primary-200/90">Last updated: {lastUpdated}</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
        <p className="text-muted leading-relaxed">When you create an account, we collect your name, email address, and optional profile information such as your school, grade level, subjects, and profile photo. We also collect usage data such as posts, comments, and lesson plans you create on the platform.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
        <p className="text-muted leading-relaxed">We use your information to provide and improve EduConnect, send you notifications you've opted into, and personalise your experience. We do not sell your personal data to third parties.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">3. Data Storage</h2>
        <p className="text-muted leading-relaxed">Your data is stored securely using Google Firebase services, which comply with industry-standard security practices. Uploaded files are stored in Firebase Cloud Storage.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">4. Cookies</h2>
        <p className="text-muted leading-relaxed">We use cookies to maintain your authentication session and remember your preferences. See our <a href="/cookies" className="text-primary-900 hover:underline">Cookie Policy</a> for more details.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
        <p className="text-muted leading-relaxed">You have the right to access, correct, or delete your personal data at any time. To request data deletion, please <a href="/contact" className="text-primary-900 hover:underline">contact us</a>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">6. Content Ownership</h2>
        <p className="text-muted leading-relaxed">Educators retain full intellectual property ownership of the content they publish on EduConnect. We do not claim ownership of your lesson plans, resources, or other original content. For full details, see the <a href="/terms#content-ownership" className="text-primary-900 hover:underline">Content Ownership section of our Terms of Service</a>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
        <p className="text-muted leading-relaxed">If you have any questions about this Privacy Policy, please <a href="/contact" className="text-primary-900 hover:underline">contact us</a>.</p>
      </section>
      </div>
    </div>
  );
}
