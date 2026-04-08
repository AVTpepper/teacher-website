import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">{children}</div>
          <Sidebar />
        </div>
      </div>
      <Footer />
    </>
  );
}
