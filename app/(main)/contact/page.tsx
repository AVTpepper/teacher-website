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
    <div className="pb-12 space-y-8">
      <div className="-mx-4 -mt-4 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Support</p>
        <h1 className="mt-1 text-3xl font-bold">Contact Us</h1>
        <p className="mt-2 text-primary-100/90 text-base leading-relaxed max-w-xl">
          Have a question, feedback, or just want to say hello? We read every message.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-8">
      {submitted ? (
        <div className="rounded-xl border border-success-200 bg-success-50 p-8 text-center">
          <p className="text-3xl mb-3">✅</p>
          <h2 className="text-lg font-semibold text-foreground">Message Sent!</h2>
          <p className="text-sm text-muted mt-2">Thanks for reaching out. We&apos;ll get back to you as soon as possible.</p>
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
    </div>
  );
}
