"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { ProductExperienceSurveyModal } from "./ProductExperienceSurveyModal";
import { ProductSurveyModal } from "./ProductSurveyModal";
import { getAnalyticsConsent, subscribeAnalyticsConsent } from "../lib/analytics-consent";

const VISIT_ENDPOINT = "/api/v1/identity/analytics/visits/";
const CLICK_ENDPOINT = "/api/v1/identity/analytics/clicks/";
const PRODUCT_ACTION_ENDPOINT = "/api/v1/identity/analytics/product-action/";
const RETRY_DELAYS_MS = [0, 8_000, 18_000];
const CLICK_CATEGORIES = new Set([
  "signup", "professional_signup", "login", "establishment_contact", "faq", "security", "about",
  "navigation", "external", "feedback_open", "action", "other",
]);
const PRIVATE_PREFIXES = ["/patient", "/professionnel", "/etablissement", "/staff", "/admin", "/onboarding"];

function isPrivateRoute(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function categorizeClick(element: Element) {
  const explicit = element.getAttribute("data-track") ?? "";
  if (CLICK_CATEGORIES.has(explicit)) return explicit;
  const href = element.getAttribute("href") ?? "";
  if (/^mailto:/i.test(href)) return "establishment_contact";
  if (/^https?:\/\//i.test(href)) return "external";
  if (href.startsWith("/connexion") && href.includes("mode=register") && href.includes("profil=professionnel")) return "professional_signup";
  if (href.startsWith("/connexion") && href.includes("mode=register")) return "signup";
  if (href.startsWith("/inscription") && href.includes("profil=professionnel")) return "professional_signup";
  if (href === "/inscription" || href.startsWith("/inscription?")) return "signup";
  if (href === "/connexion" || href.startsWith("/connexion?")) return "login";
  if (href.startsWith("/faq") || href.startsWith("/aide")) return "faq";
  if (href.startsWith("/securite")) return "security";
  if (href.startsWith("/a-propos")) return "about";
  if (href.startsWith("/")) return "navigation";
  return "action";
}

export function AnonymousVisitorTracker() {
  const pathname = usePathname();
  const analyticsConsent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => null);
  const [visitorSurveyOpen, setVisitorSurveyOpen] = useState(false);
  const [productSurveyOpen, setProductSurveyOpen] = useState(false);
  const lastPathSent = useRef<string | null>(null);
  const visitorCookieReady = useRef(false);
  const visitorSurveyOpenRef = useRef(false);
  const productSurveyOpenRef = useRef(false);
  const pendingProductSurvey = useRef(false);

  const closeVisitorSurvey = useCallback(() => {
    visitorSurveyOpenRef.current = false;
    setVisitorSurveyOpen(false);
    if (pendingProductSurvey.current) {
      pendingProductSurvey.current = false;
      productSurveyOpenRef.current = true;
      setProductSurveyOpen(true);
    }
  }, []);
  const closeProductSurvey = useCallback(() => {
    productSurveyOpenRef.current = false;
    setProductSurveyOpen(false);
  }, []);

  useEffect(() => {
    if (analyticsConsent !== "accepted" || !pathname || lastPathSent.current === pathname) return;
    lastPathSent.current = pathname;
    let cancelled = false;

    void (async () => {
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
        if (RETRY_DELAYS_MS[attempt]) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        if (cancelled) return;
        try {
          const response = await fetch(VISIT_ENDPOINT, {
            method: "POST", credentials: "include", cache: "no-store", keepalive: true,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: pathname }),
          });
          const isApiJson = response.headers.get("content-type")?.includes("application/json") ?? false;
          const payload = isApiJson ? await response.json().catch(() => null) : null;
          if (response.ok && isApiJson) {
            visitorCookieReady.current = true;
            if (payload?.data?.survey_due === true) {
              if (productSurveyOpenRef.current) pendingProductSurvey.current = true;
              else { visitorSurveyOpenRef.current = true; setVisitorSurveyOpen(true); }
            }
          }
          if ((response.ok && isApiJson) || (response.status >= 400 && response.status < 500) || attempt === RETRY_DELAYS_MS.length - 1) return;
        } catch {
          if (attempt === RETRY_DELAYS_MS.length - 1) return;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pathname, analyticsConsent]);

  useEffect(() => {
    async function claimProductSurvey() {
      try {
        const csrf = await primeCsrf();
        if (!csrf.ok) return;
        const response = await fetch(PRODUCT_ACTION_ENDPOINT, {
          method: "POST", credentials: "include", cache: "no-store",
          headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
          body: "{}",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.data?.survey_due !== true) return;
        if (visitorSurveyOpenRef.current) pendingProductSurvey.current = true;
        else { productSurveyOpenRef.current = true; setProductSurveyOpen(true); }
      } catch { /* Le questionnaire ne doit jamais bloquer une action produit. */ }
    }
    const onProductAction = () => { if (analyticsConsent === "accepted") void claimProductSurvey(); };
    window.addEventListener("ecarnet:product-action-completed", onProductAction);
    return () => window.removeEventListener("ecarnet:product-action-completed", onProductAction);
  }, [analyticsConsent]);

  useEffect(() => {
    if (analyticsConsent !== "accepted" || !pathname || isPrivateRoute(pathname)) return;
    function onClick(event: MouseEvent) {
      if (!visitorCookieReady.current || !(event.target instanceof Element)) return;
      const element = event.target.closest("a, button, [role='button']");
      if (!element || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return;
      const category = categorizeClick(element);
      void fetch(CLICK_ENDPOINT, {
        method: "POST", credentials: "include", cache: "no-store", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, path: pathname }),
      }).catch(() => undefined);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, analyticsConsent]);

  return <>
    <ProductSurveyModal open={visitorSurveyOpen} onClose={closeVisitorSurvey} />
    <ProductExperienceSurveyModal open={productSurveyOpen} onClose={closeProductSurvey} />
  </>;
}
