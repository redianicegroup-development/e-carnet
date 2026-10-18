"use client";

import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 320);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;
  return (
    <button
      className="button primary public-scroll-top"
      type="button"
      aria-label="Remonter en haut de la page"
      title="Remonter en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
    >
      <Icon name="arrowUp" size={22} />
    </button>
  );
}
