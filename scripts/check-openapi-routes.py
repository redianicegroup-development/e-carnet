#!/usr/bin/env python3
"""Fail when the documented C7 API routes drift from Django URL declarations."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
OPENAPI_FILE = ROOT / "docs" / "api" / "openapi.yaml"

# This guard intentionally scopes itself to the API surface updated by C7. Other
# legacy routes are not yet promised as complete OpenAPI coverage.
def is_c7_route(path: str) -> bool:
    return (
        path.startswith("/api/v1/patient/care/appointments/")
        or path.startswith("/api/v1/patient/care/professional/appointments/")
        or path.startswith("/api/v1/patient/care/establishment/") and "/appointments/" in path
        or path.startswith("/api/v1/patient/care/encounters/")
        or path.startswith("/api/v1/patient/care/professional/access-grants/") and path.endswith("/encounters/")
        or "/preconsultation-templates/" in path
        or "/patients/" in path and path.endswith("/openings/") and path.startswith("/api/v1/establishments/")
        or path.startswith("/api/v1/establishments/") and "/openings/" in path
        or path.startswith("/api/v1/establishments/") and path.endswith("/medical-referent/")
        or path.startswith("/api/v1/establishments/") and path.endswith("/join-codes/active-count/")
        or path == "/api/v1/identity/monitoring/webhook/"
    )


def iter_urlpatterns(patterns, prefix=""):
    from django.urls import URLPattern, URLResolver

    for entry in patterns:
        route = prefix + str(entry.pattern)
        if isinstance(entry, URLResolver):
            yield from iter_urlpatterns(entry.url_patterns, route)
        elif isinstance(entry, URLPattern):
            path = "/" + re.sub(r"<(?:(?:[a-zA-Z_][a-zA-Z0-9_]*):)?([a-zA-Z_][a-zA-Z0-9_]*)>", r"{\1}", route).lstrip("/")
            if is_c7_route(path):
                # OpenAPI's server URL already contributes the /api/v1 prefix.
                documented_path = path.removeprefix("/api/v1")
                callback = entry.callback
                view_class = getattr(callback, "cls", None)
                methods = set()
                if view_class:
                    configured_methods = getattr(callback, "view_initkwargs", {}).get(
                        "http_method_names", view_class.http_method_names
                    )
                    for method in ("get", "post", "put", "patch", "delete"):
                        if method in configured_methods and callable(getattr(view_class, method, None)):
                            methods.add(method)
                yield documented_path, methods


def spec_paths_and_methods(text: str):
    lines = text.splitlines()
    paths = {}
    current = None
    in_paths = False
    for index, line in enumerate(lines):
        if line == "paths:":
            in_paths = True
            continue
        if in_paths and line.startswith("components:"):
            break
        if not in_paths:
            continue
        match = re.match(r"^  (/[^:]+):\s*$", line)
        if match:
            current = match.group(1)
            paths[current] = set()
            continue
        if current is not None:
            operation = re.match(r"^    (get|post|put|patch|delete):\s*$", line)
            if operation:
                paths[current].add(operation.group(1))
    return paths


def main() -> int:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    os.environ.setdefault("DJANGO_DEBUG", "true")
    os.environ.setdefault("DJANGO_SECRET_KEY", "c7-openapi-check-only")
    sys.path.insert(0, str(API_ROOT))

    import django
    django.setup()
    from django.urls import get_resolver

    declared: dict[str, set[str]] = {}
    for path, methods in iter_urlpatterns(get_resolver().url_patterns):
        declared.setdefault(path, set()).update(methods)

    documented = spec_paths_and_methods(OPENAPI_FILE.read_text(encoding="utf-8"))
    missing_paths = sorted(set(declared) - set(documented))
    missing_methods = sorted(
        (path, method)
        for path, methods in declared.items()
        for method in methods - documented.get(path, set())
    )
    if missing_paths or missing_methods:
        if missing_paths:
            print("Chemins Django C7 absents de docs/api/openapi.yaml:", file=sys.stderr)
            for path in missing_paths:
                print(f"  {path}", file=sys.stderr)
        if missing_methods:
            print("Méthodes Django C7 absentes de docs/api/openapi.yaml:", file=sys.stderr)
            for path, method in missing_methods:
                print(f"  {method.upper()} {path}", file=sys.stderr)
        return 1

    print(f"OpenAPI C7 conforme : {len(declared)} chemins et méthodes Django couverts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
