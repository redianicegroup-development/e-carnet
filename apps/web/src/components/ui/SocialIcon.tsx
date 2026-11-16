import type { SVGProps } from "react";

/** Pictogrammes des réseaux du menu et du pied de page (WhatsApp, Facebook). L'e-mail utilise l'icône « mail » du jeu commun. Décoratifs : le lien porte son nom. */
export function SocialIcon({ name, size = 22, ...props }: Omit<SVGProps<SVGSVGElement>, "name"> & { name: "whatsapp" | "facebook"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {name === "facebook"
        ? <path fill="currentColor" d="M13.6 21v-7.5h2.6l.45-3.1H13.6V8.5c0-.9.3-1.5 1.6-1.5h1.7V4.2c-.3 0-1.3-.2-2.5-.2-2.5 0-4.1 1.5-4.1 4.2v2.2H7.6v3.1h2.7V21z" />
        : <>
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M12 3.2a8.8 8.8 0 0 0-7.5 13.4L3.3 20.7l4.2-1.1A8.8 8.8 0 1 0 12 3.2z" />
          <path fill="currentColor" d="M9.1 7.9c-.3 0-.6.1-.8.4-.4.5-.8 1.2-.4 2.2.7 1.8 2.1 3.4 3.9 4.4 1.2.6 2.1.5 2.7.1.4-.3.7-.8.7-1.2 0-.2-.1-.3-.3-.4l-1.5-.7c-.2-.1-.4 0-.5.1l-.6.7c-.1.1-.3.2-.5.1-.9-.4-1.7-1.1-2.2-2-.1-.2-.1-.3 0-.5l.5-.6c.1-.1.1-.3 0-.5l-.7-1.5c-.1-.2-.3-.3-.5-.3z" />
        </>}
    </svg>
  );
}
