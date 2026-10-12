#!/usr/bin/env python3
"""
E-carnet — génération du système de logo (statut : PROPOSÉ, à valider).

Signe « Carnet à bouton » : un carnet à reliure (3 anneaux) dont la couverture porte un interrupteur ouvert.
Le carnet dit « mon carnet de santé » ; l'interrupteur dit « c'est moi qui décide ». Pas de croix médicale,
pas de cadenas (le brief V3 les écarte : promesse absolue de sécurité).

Construction (grille 96 x 96, tout est vectoriel, aucune police) :
  dos relié    : bande x14..25 (coins gauches r12) ; charnière (jeu de 3) ; couverture x28..86 y10..86 (coins droits r12)
  interrupteur : pilule évidée x37 y37 l40 h22 r11 ; bouton = cercle r7 en (66, 48)
  logotype    : « e-carnet » monoligne, trait 6 (extrémités rondes), hauteur d'x 28 — dessiné lettre par lettre
Aucune couleur n'est « codée » dans la géométrie : les variantes ne changent que les 4 couleurs ci-dessous.
"""
import os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)

SAUGE, ENCRE, BRUME, ACCENT, BLANC = "#597C66", "#2C3A33", "#F2F5EF", "#A9C4A5", "#FFFFFF"

# ---------------------------------------------------------------- signe
# Boîte de tracé : x14..86, y10..86 (72 x 76). Dos relié x14..25 ; charnière (jeu) x25..28 ; couverture x28..86.
SYM_W, SYM_H, SYM_X, SYM_Y = 72, 76, 14, 10
SPINE = "M25 10.04 A12 12 0 0 0 14 22 V74 A12 12 0 0 0 25 85.96 Z"
COVER = ("M31 10 H74 A12 12 0 0 1 86 22 V74 A12 12 0 0 1 74 86 H31 A3 3 0 0 1 28 83 V13 A3 3 0 0 1 31 10 Z "
         "M57 37 H57 A0 0 0 0 0 57 37 Z")   # (placeholder remplacé ci-dessous)
def _pill(x, y, w, h):
    r = h / 2
    return f"M{x + r} {y} H{x + w - r} A{r} {r} 0 0 1 {x + w - r} {y + h} H{x + r} A{r} {r} 0 0 1 {x + r} {y} Z"
TOGGLE = (37, 37, 40, 22)                       # interrupteur évidé, centré dans la couverture
KNOB = (66, 48, 7)                              # bouton à droite = « ouvert »
COVER = ("M31 10 H74 A12 12 0 0 1 86 22 V74 A12 12 0 0 1 74 86 H31 A3 3 0 0 1 28 83 V13 A3 3 0 0 1 31 10 Z " + _pill(*TOGGLE))

def symbol(cover, spine, knob):
    """Signe complet, déplacé pour que sa boîte de tracé commence en (0, 0)."""
    return (f'<g transform="translate({-SYM_X} {-SYM_Y})"><path d="{SPINE}" fill="{spine}"/>'
            f'<path d="{COVER}" fill="{cover}" fill-rule="evenodd"/>'
            f'<circle cx="{KNOB[0]}" cy="{KNOB[1]}" r="{KNOB[2]}" fill="{knob}"/></g>')

# ---------------------------------------------------------------- logotype monoligne « e-carnet »
S = 6          # épaisseur du trait
R = 11         # rayon des rondes (hauteur d'x extérieure = 2R + S = 28)
CY = 26        # axe de la hauteur d'x
def e(x):  return f"M{x+3} {CY} H{x+25} A{R} {R} 0 1 0 {x+22.4} {CY+7.1}"
def c(x):  return f"M{x+22.4} {CY-7.1} A{R} {R} 0 1 0 {x+22.4} {CY+7.1}"
def a(x):  return f"M{x+25} {CY} A{R} {R} 0 1 0 {x+3} {CY} A{R} {R} 0 1 0 {x+25} {CY} M{x+25} 15 V37"
def r_(x): return f"M{x+4} 15 V37 M{x+4} 27 C{x+4} 19 {x+8} 15 {x+16} 15"
def n(x):  return f"M{x+4} 15 V37 M{x+4} 26 C{x+4} 19 {x+9} 15 {x+14} 15 C{x+20} 15 {x+24} 19 {x+24} 26 V37"
def t(x):  return f"M{x+9} 6 V30 Q{x+9} 37 {x+17} 37 M{x+2} 15 H{x+17}"
def dash(x): return f"M{x+1} 27 H{x+11}"
LETTERS = [(e, 28), (dash, 12), (c, 26), (a, 28), (r_, 20), (n, 28), (e, 28), (t, 19)]
GAP = 5
def wordmark_paths():
    x, ds = 0, []
    for fn, adv in LETTERS:
        ds.append(fn(x)); x += adv + GAP
    return " ".join(ds), x - GAP

def wordmark(color):
    d, width = wordmark_paths()
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{S}" stroke-linecap="round" stroke-linejoin="round"/>', width

def svg(w, h, body, title, vb=None):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" role="img" aria-labelledby="t">'
            f'<title id="t">{title}</title>{body}</svg>\n')

def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f: f.write(content)

TITLE = "E-carnet — Mon Carnet Numérique"
WMS = 1.1                                   # échelle du logotype dans les lockups
GAPX = 16                                   # espace signe / logotype
def lockup_h(cover, spine, knob, word):
    wm, w = wordmark(word)
    wmw = w * WMS
    total = SYM_W + GAPX + wmw + 3
    cy = SYM_H / 2
    body = symbol(cover, spine, knob) + f'<g transform="translate({SYM_W + GAPX} {cy - CY * WMS:.2f}) scale({WMS})">{wm}</g>'
    return total, body
def lockup_v(cover, spine, knob, word):
    wm, w = wordmark(word)
    wmw = w * 1.25
    width = max(SYM_W, wmw + 6)
    body = (f'<g transform="translate({(width - SYM_W) / 2:.2f} 0)">{symbol(cover, spine, knob)}</g>'
            f'<g transform="translate({(width - wmw) / 2:.2f} {SYM_H + 14}) scale(1.25)">{wm}</g>')
    return width, body

COLORS = {"": (SAUGE, ENCRE, SAUGE, ENCRE), "-mono-ink": (ENCRE,) * 4, "-mono-white": (BLANC,) * 4, "-on-dark": (ACCENT, BRUME, ACCENT, BRUME)}
for suffix, cols in COLORS.items():
    write(f"logo-symbol{suffix}.svg", svg(SYM_W, SYM_H, symbol(*cols[:3]), TITLE))
    total, body = lockup_h(*cols)
    write(f"logo-horizontal{suffix}.svg", svg(round(total), SYM_H, body, TITLE))
width, body = lockup_v(SAUGE, ENCRE, SAUGE, ENCRE)
write("logo-vertical.svg", svg(round(width), 146, body, TITLE))
_wm, _w = wordmark(ENCRE)
write("logo-wordmark.svg", svg(round(_w + 8), 44, f'<g transform="translate(4 0)">{_wm}</g>', TITLE))

# ---- icône d'application : fond sauge plein cadre, signe clair au centre (zone sûre « maskable » = 80 %)
def app_icon(size=512):
    k = size * 0.50 / SYM_W                 # le signe occupe 50 % de la largeur, bien dans la zone sûre de 80 %
    ox, oy = (size - SYM_W * k) / 2, (size - SYM_H * k) / 2
    return svg(size, size, f'<rect width="{size}" height="{size}" fill="{SAUGE}"/><g transform="translate({ox:.1f} {oy:.1f}) scale({k:.4f})">{symbol(BRUME, ENCRE, BRUME)}</g>', TITLE)
write("app-icon.svg", app_icon())

# ---- favicon : même signe, cadré serré en carré pour tenir à 16 px
fav = symbol(SAUGE, ENCRE, SAUGE)
write("favicon.svg", svg(76, 76, f'<g transform="translate(2 0)">{fav}</g>', TITLE))
print("écrit :", sorted(os.listdir(OUT)))
