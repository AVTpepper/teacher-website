import type { Metadata } from "next";
import HomepageGate from "@/components/landing/HomepageGate";

export const metadata: Metadata = {
  title: "VistaTeacher | Find Your People in Education",
  description:
    "VistaTeacher helps educators connect with peers, discover communities, and grow their professional network.",
};

export default function RootPage() {
  return <HomepageGate />;
}
