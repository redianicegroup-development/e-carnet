"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AuthMode = "login" | "register";
/** Mobile : « welcome » = écran d'accueil (boutons), « form » = formulaire e‑mail. Sur grand écran le formulaire est toujours visible. */
export type AuthStep = "welcome" | "form";
export type AuthStatus = "idle" | "busy" | "error" | "success";

type AuthUi = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  step: AuthStep;
  setStep: (step: AuthStep) => void;
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
  firstName: string;
  setFirstName: (firstName: string) => void;
};

const AuthUiContext = createContext<AuthUi | null>(null);

/* État partagé par la scène (personnage, bulle, mouvement) et le formulaire : la scène réagit à ce que la personne fait. */
export function AuthUiProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("welcome");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [firstName, setFirstName] = useState("");
  const value = useMemo(() => ({ mode, setMode, step, setStep, status, setStatus, firstName, setFirstName }), [mode, step, status, firstName]);
  return <AuthUiContext.Provider value={value}>{children}</AuthUiContext.Provider>;
}

export function useAuthUi(): AuthUi {
  const value = useContext(AuthUiContext);
  if (!value) throw new Error("useAuthUi doit être utilisé sous <AuthUiProvider> (page de connexion).");
  return value;
}
