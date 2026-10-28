"""Vérifie le script d'envoi d'événements : en-têtes, signature, corps et codes de sortie (serveur local factice)."""
import hashlib
import hmac
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET = "secret-de-test-monitoring"
received = {}


class Handler(BaseHTTPRequestHandler):
    status = 200

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        received.update(path=self.path, body=body, timestamp=self.headers.get("X-Ecarnet-Monitor-Timestamp", ""), signature=self.headers.get("X-Ecarnet-Monitor-Signature", ""))
        self.send_response(Handler.status)
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *_args):
        pass


def send(server, *extra, secret=SECRET, base_url=True):
    env = {k: v for k, v in os.environ.items() if not k.startswith("ECARNET_MONITOR")}
    if secret:
        env["ECARNET_MONITOR_WEBHOOK_SECRET"] = secret
    args = [sys.executable, "ops/send-monitoring-event.py", "api:test", "open", "--summary", "Événement de test é.", "--severity", "major", "--category", "database", *extra]
    if base_url:
        args += ["--base-url", f"http://127.0.0.1:{server.server_port}"]
    return subprocess.run(args, cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        ok = send(server)
        assert ok.returncode == 0, ok.stderr
        assert received["path"] == "/api/v1/identity/monitoring/webhook/", received["path"]
        payload = json.loads(received["body"])
        assert payload == {"incident_key": "api:test", "action": "open", "severity": "major", "category": "database", "summary": "Événement de test é."}, payload
        expected = hmac.new(SECRET.encode(), received["timestamp"].encode() + b"." + received["body"], hashlib.sha256).hexdigest()
        assert received["signature"] == f"sha256={expected}", "signature différente de celle que le serveur recalcule"
        assert abs(time.time() - int(received["timestamp"])) < 30, "horodatage inattendu"
        assert SECRET not in ok.stdout + ok.stderr, "le secret ne doit jamais être affiché"

        Handler.status = 401
        refused = send(server)
        assert refused.returncode == 1 and "refusé (401)" in refused.stderr, refused.stderr
        Handler.status = 200

        assert send(server, secret="").returncode == 2, "sans secret : mauvais usage"
        assert send(server, base_url=False).returncode == 2, "sans adresse : mauvais usage"
        server.shutdown()
        server.server_close()
        unreachable = subprocess.run(
            [sys.executable, "ops/send-monitoring-event.py", "api:test", "open", "--summary", "x", "--base-url", f"http://127.0.0.1:{server.server_port}", "--timeout", "2"],
            cwd=ROOT, env={**os.environ, "ECARNET_MONITOR_WEBHOOK_SECRET": SECRET}, capture_output=True, text=True, timeout=15,
        )
        assert unreachable.returncode == 1 and "injoignable" in unreachable.stderr, unreachable.stderr
    finally:
        server.shutdown()
    print("OK : événement signé, refus, usage et API injoignable vérifiés.")


if __name__ == "__main__":
    main()
