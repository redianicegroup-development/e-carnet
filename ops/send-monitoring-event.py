#!/usr/bin/env python3
"""Envoie un événement de monitoring signé au webhook de Mon E-Carnet (docs/MONITORING-WEBHOOK.md).

Exemples :
  ECARNET_MONITOR_WEBHOOK_SECRET=... python ops/send-monitoring-event.py api:readiness-down open \\
      --base-url https://api.exemple.ci --severity critical --category api --summary "Readiness indisponible."
  ... python ops/send-monitoring-event.py api:readiness-down resolve --summary "Readiness revenue."

Le secret se lit uniquement dans ECARNET_MONITOR_WEBHOOK_SECRET : jamais en argument (visible dans `ps`) ni affiché.
Aucune donnée médicale, aucun identifiant patient : seulement une clé d'incident, une gravité, une catégorie et un résumé technique.
Code de sortie : 0 accepté, 1 refusé ou injoignable, 2 mauvais usage (secret ou adresse manquants).
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request

WEBHOOK_PATH = "/api/v1/identity/monitoring/webhook/"


def sign(secret: str, timestamp: str, body: bytes) -> str:
    """HMAC-SHA256 de « horodatage.corps » en hexadécimal, comme attendu par le serveur."""
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Envoie un événement de monitoring signé.")
    parser.add_argument("incident_key", help="clé stable de l'incident, ex. api:readiness-down")
    parser.add_argument("action", choices=("open", "resolve"))
    parser.add_argument("--summary", required=True, help="résumé technique, 240 caractères maximum")
    parser.add_argument("--severity", default="warning", choices=("info", "warning", "major", "critical"))
    parser.add_argument("--category", default="api", choices=("api", "database", "cache", "storage", "backup", "email", "security"))
    parser.add_argument("--base-url", default=os.environ.get("ECARNET_MONITOR_BASE_URL", ""), help="adresse de l'API (sinon ECARNET_MONITOR_BASE_URL)")
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args(argv)

    secret = os.environ.get("ECARNET_MONITOR_WEBHOOK_SECRET", "")
    if not secret:
        print("ECARNET_MONITOR_WEBHOOK_SECRET est absent.", file=sys.stderr)
        return 2
    if not args.base_url:
        print("Adresse de l'API manquante (--base-url ou ECARNET_MONITOR_BASE_URL).", file=sys.stderr)
        return 2

    body = json.dumps(
        {"incident_key": args.incident_key, "action": args.action, "severity": args.severity, "category": args.category, "summary": args.summary},
        separators=(",", ":"), ensure_ascii=False,
    ).encode("utf-8")
    timestamp = str(int(time.time()))
    request = urllib.request.Request(
        args.base_url.rstrip("/") + WEBHOOK_PATH, data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Ecarnet-Monitor-Timestamp": timestamp,
            "X-Ecarnet-Monitor-Signature": "sha256=" + sign(secret, timestamp, body),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            print(f"Événement accepté ({response.status}) : {args.incident_key} {args.action}")
            return 0
    except urllib.error.HTTPError as error:
        print(f"Événement refusé ({error.code}) : {args.incident_key} {args.action}", file=sys.stderr)
        return 1
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"API injoignable : {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
