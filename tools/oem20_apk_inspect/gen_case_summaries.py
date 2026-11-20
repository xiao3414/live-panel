"""Regenerate the per-module case summaries (模块摘要_2.0) from master_2.0.xlsx.

Grouping: module path of each case minus its last segment (the field), i.e. the
owning sub-block. Old summaries are archived by the caller.

Run: python gen_case_summaries.py
"""
import collections
import os
import re
import shutil

import openpyxl

ROOT = r"C:/Users/urovo/Desktop/测试知识库"
CASES = os.path.join(ROOT, "02_用例库", "OEMConfig", "master_2.0.xlsx")
OUT = os.path.join(ROOT, "02_用例库", "OEMConfig", "模块摘要_2.0")
ARCHIVE = os.path.join(OUT, "_旧版_20260928")


def safe(name: str) -> str:
    name = name.replace(" / ", " _ ")
    name = re.sub(r'[\\/:*?"<>|]', "-", name)
    return name[:150].strip()


def main() -> None:
    wb = openpyxl.load_workbook(CASES, data_only=True)
    rows = list(wb["用例"].iter_rows(min_row=2, values_only=True))
    groups: dict[str, list[tuple]] = collections.OrderedDict()
    for r in rows:
        name, path, item, value = (str(x).strip() if x else "" for x in r[:4])
        parts = [p.strip() for p in path.split(" / ")]
        key = " / ".join(parts[:-1]) if len(parts) > 1 else path
        groups.setdefault(key, []).append((name, item, value))

    if not os.path.isdir(ARCHIVE):
        os.makedirs(ARCHIVE)
    for f in os.listdir(OUT):
        p = os.path.join(OUT, f)
        if os.path.isfile(p) and f.endswith(".md"):
            shutil.move(p, os.path.join(ARCHIVE, f))

    for path, items in sorted(groups.items()):
        lines = [
            "---",
            "project: OEMConfig",
            f"module: {path}",
            "type: 模块用例摘要",
            f"case_count: {len(items)}",
            "source: master_2.0.xlsx（按开发交付手册口径）",
            "---",
            "",
            f"# {path} — 用例摘要（供 AI 检索）",
            "",
            "> 明细见 `master_2.0.xlsx`；一格配置项 × 一个取值 = 一条用例。",
            "",
            "| 用例名称 | 配置项 | 取值 |",
            "|----------|--------|------|",
        ]
        for name, item, value in items:
            lines.append(f"| {name} | {item} | {value} |")
        fp = os.path.join(OUT, safe(path) + ".md")
        open(fp, "w", encoding="utf-8").write("\n".join(lines) + "\n")

    print("groups:", len(groups), "cases:", len(rows), "->", OUT)


if __name__ == "__main__":
    main()
