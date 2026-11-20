"""Generate the OEMConfig 2.0 field inventory (markdown) from the developer manuals.

Source of truth:
  01_项目说明/OEMConfig_2.0_框架_产品/urovo-oemconfig-user-manual.html      (EN)
  01_项目说明/OEMConfig_2.0_框架_产品/urovo-oemconfig-user-manual-zh.html   (ZH)

The two manuals are row-for-row identical in structure, so they are parsed in
parallel: EN supplies field names / option lists, ZH supplies the Chinese
description.

Output: 03_接口与配置映射/OEMConfig_2.0_产品框架/<Domain>.md  (8 files)
Run:  python gen_oem20_inventory.py
"""
from __future__ import annotations

import os
import re

ROOT = r"C:/Users/urovo/Desktop/测试知识库"
PRODUCT = os.path.join(ROOT, "01_项目说明", "OEMConfig_2.0_框架_产品")
OUT = os.path.join(ROOT, "03_接口与配置映射", "OEMConfig_2.0_产品框架")

EN_HTML = os.path.join(PRODUCT, "urovo-oemconfig-user-manual.html")
ZH_HTML = os.path.join(PRODUCT, "urovo-oemconfig-user-manual-zh.html")

DOMAINS = [
    ("1 Network Configuration", "Network Configuration", "网络配置"),
    ("2 System Configuration", "System Configuration", "系统配置"),
    ("3 Application Management", "Application Management", "应用管理"),
    ("4 Package Configuration", "Package Configuration", "按应用配置"),
    ("5 Security & Restriction", "Security_Restriction", "安全与限制"),
    ("6 Data Capture & Peripherals", "Data Capture _ Peripherals", "数据采集与外设"),
    ("7 Device Maintenance", "Device Maintenance", "设备维护"),
    ("8 Profile Configuration", "Profile Configuration", "配置文件"),
]
KNOWN = {d[0] for d in DOMAINS}

TABLE_RE = re.compile(r"<table.*?</table>", re.S | re.I)
ROW_RE = re.compile(r"<tr.*?</tr>", re.S | re.I)
CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S | re.I)
TOKEN_RE = re.compile(r"<table.*?</table>|<h([1-4])[^>]*>(.*?)</h\1>", re.S | re.I)
TAG_RE = re.compile(r"<[^>]+>")


def clean(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = TAG_RE.sub("", s)
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<")
          .replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'")
          .replace("\\'", "'"))
    return re.sub(r"\s+", " ", s).strip()


def parse_structure(path: str) -> dict[str, list[dict]]:
    """Return {domain: [ {name, subs: [ {name, rows:[[cells]] } ] } ]}."""
    doc = open(path, encoding="utf-8").read()
    tree: dict[str, list[dict]] = {d: [] for d in KNOWN}
    h2 = ""
    h3: dict | None = None
    sub: dict | None = None
    for m in TOKEN_RE.finditer(doc):
        frag = m.group(0)
        if frag.lower().startswith("<table"):
            if h2 not in KNOWN:
                continue
            if h3 is None:  # rows directly under the module heading
                h3 = {"name": h2.split(" ", 1)[1], "subs": []}
                tree[h2].append(h3)
            if sub is None:
                sub = {"name": "", "rows": []}
                h3["subs"].append(sub)
            for rm in ROW_RE.finditer(frag):
                cells = [clean(c) for c in CELL_RE.findall(rm.group(0))]
                if len(cells) >= 3 and cells[0].lower() not in ("field", "字段", "#"):
                    sub["rows"].append(cells)
            continue
        level, text = int(m.group(1)), clean(m.group(2))
        if level == 2:
            h2 = text
            h3 = sub = None
        elif level == 3 and h2 in KNOWN:
            h3 = {"name": text, "subs": []}
            sub = None
            tree[h2].append(h3)
        elif level == 4 and h2 in KNOWN and h3 is not None:
            sub = {"name": text, "rows": []}
            h3["subs"].append(sub)
    return tree


def dedupe(rows: list[list[str]]) -> list[list[str]]:
    seen, out = set(), []
    for r in rows:
        if r[0] in seen:
            continue
        seen.add(r[0])
        out.append(r)
    return out


def md(s: str) -> str:
    return s.replace("|", "/").strip()


def build(idx: int, manual_h2: str, zh_name: str, tree_dom: list[dict], zh_dom: list[dict]) -> tuple[str, int]:
    lines: list[str] = []
    total = 0

    # summary table
    summary_rows = []
    body: list[str] = []
    for i, mod in enumerate(tree_dom, start=1):
        zmod = zh_dom[i - 1] if i - 1 < len(zh_dom) else {"subs": []}
        count = sum(len(dedupe(s["rows"])) for s in mod["subs"])
        total += count
        summary_rows.append((i, mod["name"], count))
        body.append(f"## {idx}.{i} {mod['name']}")
        body.append("")
        j = 0
        for k, s in enumerate(mod["subs"]):
            rows = dedupe(s["rows"])
            zs = zmod["subs"][k] if k < len(zmod["subs"]) else {"rows": []}
            zrows = zs["rows"]
            if s["name"]:
                j += 1
                body.append(f"### {idx}.{i}.{j} {s['name']}")
                body.append("")
            if not rows:
                if s["name"]:
                    body.append("> 分组节点：字段在其子块中配置；可重复分组（Box）可用 “+” 增加多条。")
                else:
                    body.append("> 该模块下仅含子块，无本级字段。")
                body.append("")
                continue
            body.append("| 配置项 | 选项 / 类型 | 说明 |")
            body.append("|--------|-------------|------|")
            for n, r in enumerate(rows):
                desc_zh = zrows[n][2] if n < len(zrows) and len(zrows[n]) >= 3 else ""
                name = md(r[0])
                opts = md(r[1]) or "—"
                desc = md(desc_zh) or md(r[2]) or "—"
                body.append(f"| **{name}** | {opts} | {desc} |")
            body.append("")

    lines += [
        "---",
        "project: OEMConfig",
        f"domain: {manual_h2.split(' ', 1)[1]}",
        "type: 2.0实装配置项",
        f"field_count: {total}",
        "source: 开发交付手册 urovo-oemconfig-user-manual.html / -zh.html（2026-11-03）",
        "---",
        "",
        f"# {idx} {manual_h2.split(' ', 1)[1]}（{zh_name}）— 2.0 实装配置项",
        "",
        "> **来源**：开发交付的 OEMConfig 2.0 用户手册（`01_项目说明/OEMConfig_2.0_框架_产品/urovo-oemconfig-user-manual.html` 及中文版），"
        "内容与应用内托管配置定义一致，为**唯一准确口径**。",
        "> **说明**：字段名、选项名保留 EMM 表单英文原文；「说明」为手册中文释义。单选字段默认 `No change`，文本字段留空即不下发。",
        "",
        "| 子模块 | 配置项数 |",
        "|--------|----------|",
    ]
    for i, name, count in summary_rows:
        lines.append(f"| {idx}.{i} {name} | {count} |")
    lines.append(f"| **合计** | **{total}** |")
    lines.append("")
    lines += body
    lines += [
        "---",
        "",
        "重新生成：`python 10_工具开发/实况面板/tools/oem20_apk_inspect/gen_oem20_inventory.py`",
        "",
    ]
    return "\n".join(lines), total


def main() -> None:
    en = parse_structure(EN_HTML)
    zh = parse_structure(ZH_HTML)
    grand = 0
    for idx, (manual_h2, filename, zh_name) in enumerate(DOMAINS, start=1):
        text, total = build(idx, manual_h2, zh_name, en[manual_h2], zh[manual_h2])
        open(os.path.join(OUT, filename + ".md"), "w", encoding="utf-8").write(text)
        grand += total
        print(f"{filename}.md  fields={total}")
    print("TOTAL", grand)


if __name__ == "__main__":
    main()
