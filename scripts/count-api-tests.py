#!/usr/bin/env python3
"""Count Django test functions/methods from source files without running them."""
from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"


def main() -> int:
    files = []
    total = 0
    for path in sorted(API_ROOT.rglob("*.py")):
        relative = path.relative_to(API_ROOT)
        if "migrations" in relative.parts or "__pycache__" in relative.parts:
            continue
        if not (path.name.startswith("test") or path.name == "tests.py"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        count = sum(
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_")
            for node in ast.walk(tree)
        )
        if count:
            total += count
            files.append({"path": relative.as_posix(), "test_definitions": count})
    print(json.dumps({"suite": "Django API", "source_test_definitions": total, "files": files}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
