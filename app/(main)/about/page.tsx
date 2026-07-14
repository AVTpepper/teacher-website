import Link from "next/link";
import { Button } from "@/components/ui";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">About EduConnect</h1>
        <p className="mt-3 text-muted text-base leading-relaxed">
          EduConnect is the central hub for educators to connect, collaborate, and grow professionally. We believe great teachers deserve a great community.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Our Mission</h2>
        <p className="text-muted leading-relaxed">
          We're on a mission to reduce professional isolation for teachers by giving them a dedicated space to share resources, discuss challenges, discover job opportunities, and find inspiration all in one place.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">What We Offer</h2>
        <ul className="space-y-2 text-muted">
          <li className="flex items-start gap-2"><span className="text-primary-900 font-bold mt-0.5">•</span><span><strong className="text-foreground">Community Feed</strong>: Share ideas, resources, and start discussions with other educators.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary-900 font-bold mt-0.5">•</span><span><strong className="text-foreground">Lesson Builder</strong>: Create, remix, and publish lesson plans for your community.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary-900 font-bold mt-0.5">•</span><span><strong className="text-foreground">Resource Library</strong>: Discover and upload teaching resources.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary-900 font-bold mt-0.5">•</span><span><strong className="text-foreground">Forums</strong>: Dive into topic-focused discussions organised by category.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary-900 font-bold mt-0.5">•</span><span><strong className="text-foreground">Job Board</strong>: Post and find teaching and education-adjacent positions.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary-900 font-bold mt-0.5">•</span><span><strong className="text-foreground">Inspiration Hub</strong>: Curated articles, podcasts, videos, and teacher stories.</span></li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Get in Touch</h2>
        <p className="text-muted">Have questions, feedback, or want to partner with us? We'd love to hear from you.</p>
        <Link href="/contact">
          <Button variant="primary">Contact Us</Button>
        </Link>
      </section>
    </div>
  );
}
