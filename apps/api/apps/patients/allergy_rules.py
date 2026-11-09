"""UX-01 : « Aucune allergie » et « Je ne sais pas » sont deux états choisis, pas du texte libre.

Sur la carte d'urgence, une liste d'allergies vide ne dit pas si le patient n'en a pas ou s'il n'a rien renseigné, et une
phrase tapée dans le champ libre (« Je n'ai pas », « Je n'es pas ») devenait une allergie à part entière. Les deux états
sont enregistrés comme des déclarations d'allergie aux libellés ci-dessous (mêmes libellés côté web, `allergy-rules.ts`),
et le champ libre refuse les phrases de négation. Un état et de vraies allergies ne coexistent pas."""
import re
import unicodedata

ALLERGY_NONE_LABEL = "Aucune allergie connue"
ALLERGY_UNKNOWN_LABEL = "Je ne sais pas"
ALLERGY_STATE_LABELS = (ALLERGY_NONE_LABEL, ALLERGY_UNKNOWN_LABEL)
ALLERGY_NEGATION_MESSAGE = "Pour dire que vous n’avez aucune allergie, choisissez « Aucune allergie connue ». Sinon, indiquez le nom de l’allergie."

_SINGLE_WORD_NEGATIONS = {"non", "nan", "no", "nope", "rien", "aucun", "aucune", "neant", "ras", "r a s", "pas", "nul", "nulle", "sans"}
_NEGATION_PREFIXES = [re.compile(pattern) for pattern in (
    r"^(je )?n (ai|es|est|ais|a|y a) (pas|rien|aucun|aucune)\b",  # je n'ai pas…, je n'es pas… (faute courante), n'a pas…
    r"^j ai (pas|rien|aucun|aucune)\b",
    r"^(je )?(ne )?sais (pas|rien)\b",
    r"^(je )?(ne )?connais (pas|aucun|aucune)\b",
    r"^(pas|aucune?) (d|de|dallergie|allergie|allergies)\b",
    r"^(sans|aucune?) allergi",
    r"^rien (a signaler|connu)\b",
    r"^(non )?(merci|connue?)$",
)]


def normalise(text: str) -> str:
    """Minuscules, sans accents, apostrophes et ponctuation ramenées à des espaces : « Je n’es pas » → « je n es pas »."""
    decomposed = unicodedata.normalize("NFD", str(text))
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char)).lower()
    return re.sub(r"[^a-z0-9]+", " ", stripped).strip()


def is_allergy_state(label: str) -> bool:
    return str(label).strip() in ALLERGY_STATE_LABELS


def looks_like_allergy_negation(label: str) -> bool:
    """Vrai si le texte dit « je n'ai pas d'allergie » (ou « je ne sais pas ») au lieu de nommer une allergie."""
    if is_allergy_state(label):
        return False
    text = normalise(label)
    if not text:
        return False
    return text in _SINGLE_WORD_NEGATIONS or any(pattern.search(text) for pattern in _NEGATION_PREFIXES)
