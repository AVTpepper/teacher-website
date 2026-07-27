import type { Metadata } from "next";
import CommunityFeedPage from "@/components/feed/CommunityFeedPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed | VistaTeacher",
  description: "Community posts from educators on VistaTeacher.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FeedPage() {
  return <CommunityFeedPage />;
}
