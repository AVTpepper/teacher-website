import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { NarrowFormLayout } from "@/components/ui/PageLayout";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100dvh-var(--header-height))] flex-col items-center justify-center bg-linear-to-b from-page-background to-page-background-soft px-4 py-10 sm:py-14">
        <main className="w-full">
          <NarrowFormLayout>{children}</NarrowFormLayout>
        </main>
      </div>
      <Footer />
    </>
  );
}
