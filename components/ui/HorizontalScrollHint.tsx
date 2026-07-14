"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface HorizontalScrollHintProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  role?: string;
  ariaLabel?: string;
  nudgeKey?: string;
}

export default function HorizontalScrollHint({
  children,
  className = "",
  innerClassName = "",
  role,
  ariaLabel,
  nudgeKey,
}: HorizontalScrollHintProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    function updateScrollState() {
      if (!node) return;
      const maxLeft = node.scrollWidth - node.clientWidth;
      setCanScrollLeft(node.scrollLeft > 2);
      setCanScrollRight(maxLeft - node.scrollLeft > 2);
    }

    updateScrollState();
    node.addEventListener("scroll", updateScrollState, { passive: true });

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(node);

    return () => {
      node.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [children]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node || !nudgeKey) return;
    if (typeof window === "undefined") return;

    const storageKey = `hs-hint:${nudgeKey}`;
    if (window.sessionStorage.getItem(storageKey) === "seen") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      window.sessionStorage.setItem(storageKey, "seen");
      return;
    }

    const maxLeft = node.scrollWidth - node.clientWidth;
    if (maxLeft <= 8) return;

    const nudgeBy = Math.min(40, maxLeft);
    const timeout = window.setTimeout(() => {
      node.scrollTo({ left: nudgeBy, behavior: "smooth" });
      window.setTimeout(() => {
        node.scrollTo({ left: 0, behavior: "smooth" });
        window.sessionStorage.setItem(storageKey, "seen");
      }, 260);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [nudgeKey, children]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollerRef}
        role={role}
        aria-label={ariaLabel}
        className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${innerClassName}`}
      >
        {children}
      </div>

      {canScrollLeft && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent"
          aria-hidden="true"
        />
      )}

      {canScrollRight && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded-full border border-border bg-surface/90 px-1.5 py-0.5 text-[10px] text-muted"
            aria-hidden="true"
          >
            ›
          </div>
        </>
      )}
    </div>
  );
}
