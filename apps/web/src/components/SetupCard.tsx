"use client";

import Link from "next/link";
import { Icon } from "./ui/Icon";

export type SetupStep = { key: string; title: string; text?: string; done: boolean; href: string };

/* « Mise en route », identique pour le patient et le médecin : une liste d'étapes et un seul bouton
   qui mène à la prochaine étape. Quand tout est fait, la carte disparaît : elle ne sert que tant qu'il reste quelque chose à configurer. */
export function SetupCard({ title, text, steps, actionLabel = "Continuer" }: { title: string; text?: string; steps: SetupStep[]; actionLabel?: string }) {
  const done = steps.filter((step) => step.done).length;
  if (steps.length === 0 || done === steps.length) return null;
  const next = steps.find((step) => !step.done) ?? steps[0];
  return (
    <section className="card progress-card setup-card" aria-labelledby="setup-title" aria-live="polite">
      <div className="section-heading"><div><span className="eyebrow">Mise en route</span><h2 id="setup-title">{title}</h2></div></div>
      {text && <p className="muted">{text}</p>}
      <ol className="checklist setup-card__steps" aria-label="Étapes de mise en route">
        {steps.map((step, index) => {
          const state = step.done ? "done" : step === next ? "current" : "todo";
          return <li key={step.key} className={`is-${state}`}>
            <span className="checklist__mark" aria-hidden="true">{step.done ? <Icon name="check" size={16} /> : index + 1}</span>
            <div><strong>{step.title}</strong>{step.text && <><br /><span className={state === "todo" ? "muted" : ""}>{step.text}</span></>}</div>
          </li>;
        })}
      </ol>
      <div className="progress-card__meta"><span>{done}/{steps.length} étape{steps.length > 1 ? "s" : ""} faite{done > 1 ? "s" : ""}</span><Link className="text-link" href={next.href}>{actionLabel}</Link></div>
    </section>
  );
}
