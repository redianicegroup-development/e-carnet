import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Handler(BaseHTTPRequestHandler):
    readiness_status = 200

    def do_GET(self):
        code = 200 if self.path == "/api/v1/health/live/" else self.readiness_status
        self.send_response(code)
        self.end_headers()

    def log_message(self, *_args):
        pass


def run_probe(server):
    env = os.environ.copy()
    env["ECARNET_MONITOR_BASE_URL"] = f"http://127.0.0.1:{server.server_port}"
    env.pop("ECARNET_MONITOR_WEBHOOK_URL", None)
    return subprocess.run(["bash", "ops/monitoring-check.sh"], cwd=ROOT, env=env, capture_output=True, text=True, timeout=10)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        Handler.readiness_status = 200
        healthy = run_probe(server)
        assert healthy.returncode == 0, healthy.stdout + healthy.stderr
        assert "liveness PASS" in healthy.stdout and "readiness PASS" in healthy.stdout

        Handler.readiness_status = 503
        unhealthy = run_probe(server)
        assert unhealthy.returncode == 1, unhealthy.stdout + unhealthy.stderr
        assert "liveness PASS" in unhealthy.stdout and "readiness FAIL" in unhealthy.stdout
    finally:
        server.shutdown()
        server.server_close()
    print("monitoring-check: 2 scénarios réussis")


if __name__ == "__main__":
    main()
