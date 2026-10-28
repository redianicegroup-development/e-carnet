"""Génère une paire de clés VAPID pour le Web Push (aucune dépendance en plus de « cryptography »).

    python apps/api/scripts/generate-vapid-keys.py

À faire UNE fois par environnement. La clé privée va dans ECARNET_VAPID_PRIVATE_KEY (secret, jamais dans le dépôt) ;
la clé publique dans ECARNET_VAPID_PUBLIC_KEY. Changer la paire plus tard désabonne tous les appareils.
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
private_raw = key.private_numbers().private_value.to_bytes(32, "big")
public_raw = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)

print(f"ECARNET_VAPID_PUBLIC_KEY={b64url(public_raw)}")
print(f"ECARNET_VAPID_PRIVATE_KEY={b64url(private_raw)}")
print("ECARNET_VAPID_SUBJECT=mailto:contact@votre-domaine")
