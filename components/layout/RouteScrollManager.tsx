"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function RouteScrollManager() {
  const pathname = usePathname();
  const didHydrateRef = useRef(false);
  const fromPopStateRef = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      fromPopStateRef.current = true;
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      return;
    }

    if (fromPopStateRef.current) {
      fromPopStateRef.current = false;
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}