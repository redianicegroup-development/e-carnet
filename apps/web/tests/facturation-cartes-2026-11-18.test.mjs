import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

/* Facturation : les offres sont des cartes de tarifs (nom, durée, trait, gros prix, liste avec coches et croix, bouton arrondi, pastille inclinée). */

test("chaque offre est une carte : prix en gros, unité, liste de ce qui est inclus (coches) et de ce que l'offre du dessus ajoute (croix)", () => {
  const source = read("components/EstablishmentBilling.tsx");
  assert.match(source, /<article key=\{offer\.code\} className="billing__offer" data-tone=\{index % 3\} data-current=\{current\}>/);
  assert.match(source, /className="billing__amount"[\s\S]*FCFA \/ mois/);
  assert.match(source, /Sur devis/);
  assert.match(source, /data-included="true"><Icon name="check"/);
  assert.match(source, /data-included="false"><Icon name="close"/);
  assert.match(source, /Non inclus : /, "une croix ne repose pas que sur la couleur : le lecteur d'écran annonce « Non inclus »");
});

test("les croix viennent des lignes de l'offre suivante : rien d'inventé, « Toute l'offre X » n'est pas comptée, trois au plus", () => {
  const source = read("components/EstablishmentBilling.tsx");
  assert.match(source, /next\.includes\.filter\(\(line\) => !own\.has\(line\) && !\/\^toute l\[’'\]offre\/i\.test\(line\)\)\.slice\(0, MAX_MISSING\)/);
  assert.match(source, /const MAX_MISSING = 3;/);
});

test("pastille inclinée sur l'offre actuelle et sur la prochaine période ; bouton « Choisir » seulement pour une offre en libre-service", () => {
  const source = read("components/EstablishmentBilling.tsx");
  assert.match(source, /current \? "Offre actuelle" : "Prochaine période"/);
  assert.match(source, /!offer\.self_service \? <div className="billing__quote"><p>Contactez l’équipe Mon E‑Carnet pour un devis\.<\/p><a className="billing__cta billing__cta--primary" href=\{quoteRequestHref\(/, "offre sur devis : bouton « Demander un devis » vers l'e-mail de l'équipe (message prérempli)");
  assert.match(source, /className="billing__cta billing__cta--primary" onClick=\{\(\) => \{ setChoice\(offer\); setInstructions\(null\); \}\}/);
  const css = read("components/billing.css");
  assert.match(css, /\.billing__sticker \{[^}]*transform: rotate\(4deg\)/);
});

test("mise en page : colonnes qui s'adaptent, teinte par carte, liste dans un bloc teinté, bouton toujours en bas", () => {
  const css = read("components/billing.css");
  assert.match(css, /\.billing__offers \{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 230px\), 1fr\)\)/);
  assert.match(css, /\.billing__offer\[data-tone="1"\] \{ --tone: #d9941a; \}/);
  assert.match(css, /\.billing__offer\[data-tone="2"\] \{ --tone: #8566c9; \}/);
  assert.match(css, /\.billing__features \{[^}]*flex: 1[^}]*background: color-mix\(in srgb, var\(--tone\) 15%/);
  assert.match(css, /\.billing__cta:focus-visible \{ outline: 3px solid/);
  assert.match(css, /prefers-reduced-motion: no-preference\) \{ \.billing__offer \{ transition/, "le léger soulèvement au survol respecte la préférence de mouvement réduit");
});

test("le paiement reste inchangé : « Régler » donne les instructions, la confirmation vient du serveur", () => {
  const source = read("components/EstablishmentBilling.tsx");
  assert.match(source, /billing\/invoices\/\$\{invoice\.id\}\/pay\//);
  assert.doesNotMatch(source, /confirm-payment|setPaid|\.status\s*=\s*"paid"/);
  assert.match(source, /Le patient ne paie jamais/);
});
