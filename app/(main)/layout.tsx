import Navbar from "@/components/layout/Navbar";
import Sidebar, { SidebarDrawerButton } from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import SiteMessageBanner from "@/components/layout/SiteMessageBanner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="flex-1 bg-linear-to-b from-background via-secondary-50 to-background">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
          <SiteMessageBanner />
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">{children}</div>
            <Sidebar />
          </div>
        </div>
      </div>
      <Footer />
      <SidebarDrawerButton />
    </>
  );
}
