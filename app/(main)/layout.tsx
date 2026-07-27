import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MainAppFrame from "@/components/layout/MainAppFrame";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <MainAppFrame>{children}</MainAppFrame>
      <Footer />
    </>
  );
}
