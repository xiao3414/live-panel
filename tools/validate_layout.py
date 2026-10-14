# -*- coding: utf-8 -*-
"""校验 layouts/*.json 是否符合 schemas/layout.schema.json 且 probeIds 存在于 probes.yaml。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

try:
    import yaml
except ImportError:
    yaml = None


def load_probe_ids() -> set[str]:
    if yaml is None:
        raise SystemExit("pip install pyyaml")
    data = yaml.safe_load((ROOT / "registry" / "probes.yaml").read_text(encoding="utf-8"))
    return {p["id"] for p in data.get("probes", [])}


def main() -> int:
    probe_ids = load_probe_ids()
    layout_dir = ROOT / "layouts"
    errors = 0
    for path in sorted(layout_dir.glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        if doc.get("version") != 1:
            print(f"FAIL {path.name}: version must be 1")
            errors += 1
            continue
        for w in doc.get("widgets", []):
            for pid in w.get("probeIds", []):
                if pid not in probe_ids:
                    print(f"FAIL {path.name}: unknown probeId {pid}")
                    errors += 1
        if not errors:
            print(f"OK {path.name} ({len(doc.get('widgets', []))} widgets)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
