export default function SiteMessageBanner() {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-primary-800/20 bg-linear-to-r from-primary-900 via-primary-800 to-primary-700 px-6 py-4 text-white shadow-[0_12px_32px_rgba(15,76,92,0.14)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-300">
        VistaTeacher
      </p>
      <p className="mt-2 text-lg font-semibold leading-tight text-white/95 sm:text-xl">
        Built for educators who plan boldly, share generously, and grow together.
      </p>
    </div>
  );
}