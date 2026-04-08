import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 text-2xl font-bold text-primary-900"
      >
        EduConnect
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
