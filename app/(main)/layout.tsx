import Navbar from "@/components/layout/Navbar";
import Sidebar, { SidebarDrawerButton } from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import MainDetailBackButton from "@/components/layout/MainDetailBackButton";
import MainContentShell from "@/components/layout/MainContentShell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6">
        <div className="mb-6 rounded-2xl border border-primary-200/70 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 px-4 py-4 text-accent-100 shadow-lg sm:px-6">
          <p className="text-xs font-semibold tracking-widest uppercase text-accent-300">EduConnect</p>
          <p className="mt-1 text-sm text-accent-100/90">Built for educators who plan boldly, share generously, and grow together.</p>
        </div>
        <MainDetailBackButton />
        <div className="flex gap-6">
          <MainContentShell>{children}</MainContentShell>
          <Sidebar />
        </div>
      </div>
      <Footer />
      <SidebarDrawerButton />
    </>
  );
}
