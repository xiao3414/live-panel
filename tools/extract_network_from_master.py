"""从 master_2.0 提取 Network Configuration 模块清单（供 registry 规划）。"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("pip install pandas openpyxl", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[3]
MASTER = ROOT / "02_用例库" / "OEMConfig" / "master_2.0.xlsx"
PREFIX = "Network Configuration"


def main() -> None:
    if not MASTER.exists():
        print(f"missing {MASTER}")
        sys.exit(1)
    df = pd.read_excel(MASTER)
    mod_col = next(c for c in df.columns if "模块" in str(c) or c == "module")
    item_col = next(c for c in df.columns if "item" in str(c).lower() or "项" in str(c))
    sub = df[df[mod_col].astype(str).str.startswith(PREFIX)]
    print(f"rows: {len(sub)}")
    print(sub[[mod_col, item_col]].head(20).to_string())
    print("--- unique L2 paths (first 40) ---")
    paths = sub[mod_col].astype(str).unique()
    for p in sorted(paths)[:40]:
        print(p, sub[mod_col].astype(str).eq(p).sum())


if __name__ == "__main__":
    main()
