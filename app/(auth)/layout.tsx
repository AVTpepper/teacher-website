import Link from "next/link";
import { NarrowFormLayout } from "@/components/ui/PageLayout";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-linear-to-b from-page-background to-page-background-soft px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="type-heading-strong mb-8 text-2xl text-primary-900"
      >
        VistaTeacher
      </Link>
      <NarrowFormLayout>{children}</NarrowFormLayout>
    </div>
  );
}
