"use client";

import { useState, type FormEvent } from "react";
import { Input, Textarea, Button } from "@/components/ui";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // In a real implementation, send to a backend or form service.
    // For now, just show a success message.
    setSubmitted(true);
  }

  return (
    <div className="max-w-xl mx-auto py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
        <p className="mt-3 text-muted text-base leading-relaxed">
          Have a question, feedback, or just want to say hello? We read every message.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-xl border border-success-200 bg-success-50 p-8 text-center">
          <p className="text-3xl mb-3">✅</p>
          <h2 className="text-lg font-semibold text-foreground">Message Sent!</h2>
          <p className="text-sm text-muted mt-2">Thanks for reaching out. We'll get back to you as soon as possible.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
          />
          <Textarea
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind…"
            rows={6}
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Send Message
          </Button>
        </form>
      )}
    </div>
  );
}
