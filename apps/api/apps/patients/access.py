from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PatientAccess:
    """Contexte d'accès au dossier patient pour une requête donnée.

    ``*`` représente l'accès existant intégral du titulaire ou de son gardien
    légal. Les délégations futures fourniront une liste explicite de portées.
    """

    mode: str
    delegation: Any | None = None
    scopes: frozenset[str] = field(default_factory=lambda: frozenset({"*"}))

    def __post_init__(self):
        if self.mode not in {"owner", "guardian", "delegate"}:
            raise ValueError("Mode d’accès patient invalide.")
        object.__setattr__(self, "scopes", frozenset(self.scopes))
