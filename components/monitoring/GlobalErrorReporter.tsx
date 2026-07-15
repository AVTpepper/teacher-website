"use client";

import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";

interface ErrorPayload {
  message: string;
  stack?: string;
  source: "window.error" | "window.unhandledrejection";
  url: string;
  userAgent: string;
}

async function sendError(payload: ErrorPayload): Promise<void> {
  try {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    await fetch("/api/monitoring/error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Monitoring must never break the app.
  }
}

export default function GlobalErrorReporter() {
  const sentCountRef = useRef(0);

  useEffect(() => {
    const maxPerSession = 20;

    function canSend(): boolean {
      if (sentCountRef.current >= maxPerSession) return false;
      sentCountRef.current += 1;
      return true;
    }

    function handleWindowError(event: ErrorEvent) {
      if (!canSend()) return;

      void sendError({
        source: "window.error",
        message: event.message || "Unknown window error",
        stack: event.error instanceof Error ? event.error.stack : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (!canSend()) return;

      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled rejection";

      const stack = reason instanceof Error ? reason.stack : undefined;

      void sendError({
        source: "window.unhandledrejection",
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
