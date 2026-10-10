"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VISIT_ENDPOINT = "/api/v1/identity/analytics/visits/";
const RETRY_DELAYS_MS = [0, 8_000, 18_000];

export function AnonymousVisitorTracker() {
  const pathname = usePathname();
  const lastPathSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPathSent.current === pathname) return;
    lastPathSent.current = pathname;

    void (async () => {
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
        if (RETRY_DELAYS_MS[attempt]) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        try {
          const response = await fetch(VISIT_ENDPOINT, {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: pathname }),
          });
          const isApiJson = response.headers.get("content-type")?.includes("application/json") ?? false;
          if ((response.ok && isApiJson) || (response.status >= 400 && response.status < 500) || attempt === RETRY_DELAYS_MS.length - 1) return;
        } catch {
          if (attempt === RETRY_DELAYS_MS.length - 1) return;
        }
      }
    })();
  }, [pathname]);

  return null;
}
