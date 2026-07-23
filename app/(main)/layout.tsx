import Navbar from "@/components/layout/Navbar";
import Sidebar, { SidebarDrawerButton } from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import SiteMessageBanner from "@/components/layout/SiteMessageBanner";
import OnboardingGuard from "@/components/layout/OnboardingGuard";
import { TwoColumnLayout } from "@/components/ui/PageLayout";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="flex-1 bg-linear-to-b from-page-background via-page-background-soft to-page-background">
        <div className="app-container py-6 lg:py-8">
          <OnboardingGuard />
          <SiteMessageBanner />
          <TwoColumnLayout sidebar={<Sidebar />} className="mt-4">
            {children}
          </TwoColumnLayout>
        </div>
      </div>
      <Footer />
      <SidebarDrawerButton />
    </>
  );
}
