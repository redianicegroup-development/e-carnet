"use client";

import { useEffect, useState } from "react";
import { useAuthUi, type AuthMode } from "./AuthUiContext";
import { WelcomeCharacter, type CharacterMood } from "./WelcomeCharacter";

const CYCLE_MS = 4400;

function hello(now: Date) {
  const hour = now.getHours();
  return hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir";
}

function cycle(mode: AuthMode, now: Date): string[] {
  return mode === "register"
    ? ["Bienvenue sur Mon E‑Carnet", "Créons votre carnet", "Quelques secondes suffisent"]
    : ["Bienvenue sur Mon E‑Carnet", `${hello(now)} !`, "Votre carnet vous attend"];
}

/* Le personnage de la scène te souhaite la bienvenue : il change de mine selon ce qui se passe (attente, erreur, connexion
   réussie, où il t'appelle par ton prénom) et sa bulle suit. Les messages alternent doucement tant que rien ne se passe. */
export function AuthWelcome() {
  const { mode, status, firstName } = useAuthUi();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => current + 1), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const messages = cycle(mode, new Date());
  const idle = messages[index % messages.length];
  const name = firstName ? `, ${firstName}` : "";
  const text = status === "success" ? (mode === "register" ? `Bienvenue${name} !` : `Ravi de vous revoir${name} !`)
    : status === "error" ? "Oups, vérifions ça."
    : status === "busy" ? "Un instant…"
    : idle;
  const mood: CharacterMood = status === "success" ? "greet" : status === "error" ? "oops" : "idle";

  return (
    <div className="ax-welcome" data-status={status}>
      <div className="ax-welcome__bubble" role="status" aria-live="polite" key={text}><span>{text}</span></div>
      <div className="ax-welcome__character"><WelcomeCharacter mood={mood} look /></div>
    </div>
  );
}
