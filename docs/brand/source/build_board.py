#!/usr/bin/env python3
"""Assemble docs/brand/brand-board.html à partir des SVG générés et des contrastes calculés (palette.py)."""
import re, sys
from palette import cr, resolve, SAUGE_V4, WHITE

OUT = sys.argv[1]
LOGOS = sys.argv[2]

def svg(name, extra=""):
    s = open(f"{LOGOS}/{name}", encoding="utf-8").read().strip()
    s = re.sub(r'\s(width|height)="[^"]+"', "", s, count=2)
    return s.replace("<svg ", f'<svg {extra} ', 1)

R = resolve(SAUGE_V4)
def chip(fg, bg, label=None):
    v = cr(fg, bg)
    grade = "AAA" if v >= 7 else "AA" if v >= 4.5 else "AA gros texte / graphisme" if v >= 3 else "décoratif seulement"
    return f'<span class="chip">{label or ""}{v:.2f}:1 · {grade}</span>'

SWATCHES = [
    ("Sauge action", "#597C66", "Primaire : boutons, logo, liens", chip("#FFFFFF", "#597C66", "blanc dessus ")),
    ("Encre", "#2C3A33", "Texte, dos du carnet, secondaire", chip("#2C3A33", "#F2F5EF", "sur brume ")),
    ("Brume", "#F2F5EF", "Fond de l’application", chip("#2C3A33", "#F2F5EF", "encre dessus ")),
    ("Sauge pâle", "#D8E2D0", "Surfaces teintées, bordures douces", chip("#2C3A33", "#D8E2D0", "encre dessus ")),
    ("Sauge clair", "#A9C4A5", "Accent décoratif et fonds sombres", chip("#2C3A33", "#A9C4A5", "encre dessus ")),
]
swatch_html = "".join(
    f'<figure class="sw"><div class="sw__c" style="background:{h}"></div><figcaption><strong>{n}</strong><code>{h}</code><span>{u}</span>{c}</figcaption></figure>'
    for n, h, u, c in SWATCHES)

STATUS = [
    ("Déclaré", "#8A6100", "#FFF3D6", "Dit par le patient", '<circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c0-3 2.2-4.8 5-4.8s5 1.8 5 4.8"/>'),
    ("Mesuré", "#1F4E8C", "#E6EEF8", "Relevé par un outil ou un professionnel", '<path d="M2 12 L2 8 M5.5 12 L5.5 5 M9 12 L9 7 M12.5 12 L12.5 3"/>'),
    ("Vérifié", "#17704A", "#E4F5EC", "Confirmé par un professionnel", '<path d="M3 8.5 L6.5 12 L13 4.5"/>'),
    ("Contesté", "#A32D2D", "#FBEAE8", "Désaccord à examiner", '<path d="M8 2.5 L14 13.5 H2 Z"/><path d="M8 6.8 V9.8 M8 11.8 V11.9"/>'),
    ("Expiré", "#4A5550", "#E8ECE9", "N’est plus valable", '<circle cx="8" cy="8" r="5.6"/><path d="M8 4.8 V8 L10.2 9.4"/>'),
]
def badge(name, fg, bg, icon, note=None):
    return (f'<span class="badge" style="background:{bg};color:{fg}"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{icon}</svg>{name}</span>')
status_html = "".join(
    f'<li>{badge(n, fg, bg, ic)}<span>{note}</span><code>{cr(fg, bg):.2f}:1</code></li>' for n, fg, bg, note, ic in STATUS)
B = {n: badge(n, fg, bg, ic) for n, fg, bg, _, ic in STATUS}

html = open("board_template.html", encoding="utf-8").read()
rep = {
    "{{LOGO_H}}": svg("logo-horizontal.svg", 'class="lg lg--h" role="img" aria-label="Logo E-carnet horizontal"'),
    "{{LOGO_H_DARK}}": svg("logo-horizontal-on-dark.svg", 'class="lg lg--h" role="img" aria-label="Logo E-carnet sur fond sombre"'),
    "{{LOGO_V}}": svg("logo-vertical.svg", 'class="lg lg--v" role="img" aria-label="Logo E-carnet vertical"'),
    "{{LOGO_MONO_INK}}": svg("logo-horizontal-mono-ink.svg", 'class="lg lg--h" role="img" aria-label="Logo monochrome encre"'),
    "{{LOGO_MONO_WHITE}}": svg("logo-horizontal-mono-white.svg", 'class="lg lg--h" role="img" aria-label="Logo monochrome blanc"'),
    "{{SYMBOL}}": svg("logo-symbol.svg", 'class="lg lg--s" role="img" aria-label="Signe E-carnet"'),
    "{{SYMBOL_SM}}": svg("logo-symbol.svg", 'class="lg lg--xs" aria-hidden="true"'),
    "{{SYMBOL_ON_DARK}}": svg("logo-symbol-on-dark.svg", 'class="lg lg--s" aria-hidden="true"'),
    "{{APP_ICON}}": svg("app-icon.svg", 'class="appicon" role="img" aria-label="Icône d’application"'),
    "{{FAVICON}}": svg("favicon.svg", 'class="fav" aria-hidden="true"'),
    "{{WORDMARK}}": svg("logo-wordmark.svg", 'class="lg lg--w" role="img" aria-label="Logotype e-carnet"'),
    "{{SWATCHES}}": swatch_html,
    "{{STATUS}}": status_html,
    "{{B_DECLARE}}": B["Déclaré"], "{{B_MESURE}}": B["Mesuré"], "{{B_VERIFIE}}": B["Vérifié"],
    "{{B_CONTESTE}}": B["Contesté"], "{{B_EXPIRE}}": B["Expiré"],
    "{{TEXT_MUTED}}": R["textMuted"], "{{PRIMARY_TEXT}}": R["primaryText"], "{{BORDER_STRONG}}": R["borderStrong"],
    "{{C_MUTED}}": f'{cr(R["textMuted"], "#F2F5EF"):.2f}', "{{C_PTEXT}}": f'{cr(R["primaryText"], "#F2F5EF"):.2f}',
    "{{C_BSTRONG}}": f'{cr(R["borderStrong"], "#F2F5EF"):.2f}', "{{C_FOCUS}}": f'{cr("#597C66", "#F2F5EF"):.2f}',
}
for k, v in rep.items():
    html = html.replace(k, v)
left = re.findall(r"\{\{[A-Z_]+\}\}", html)
assert not left, f"gabarits non remplacés : {left}"
open(OUT, "w", encoding="utf-8").write(html)
print("planche écrite :", OUT, f"({len(html)//1024} Ko)")
