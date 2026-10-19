# -*- coding: utf-8 -*-
"""从知识库 OEM 2.0 产品框架 md 生成 registry/modules + layouts + manifest（概览占位）。"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KB = Path(r"C:\Users\urovo\Desktop\测试知识库\03_接口与配置映射\OEMConfig_2.0_产品框架")
REG = ROOT / "registry" / "modules"
LAY = ROOT / "layouts"
MAN = ROOT / "registry" / "manifest"

DOMAINS = [
    "Network Configuration",
    "System Configuration",
    "Application Management",
    "Package Configuration",
    "Security&Restriction",
    "Data Capture & Peripherals",
    "Device Maintenance",
    "Profile Configuration",
]

SKIP_REGENERATE = {"network.yaml"}  # 保留手写的 network 模块


def md_path(domain: str) -> Path:
    safe = re.sub(r'[<>:"/\\|?*&]', "_", domain)
    return KB / f"{safe}.md"


def parse_domain_md(domain: str) -> list[dict]:
    path = md_path(domain)
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|") or line.startswith("| L2") or line.startswith("|----"):
            continue
        parts = [p.strip() for p in line.split("|")[1:-1]]
        if len(parts) < 7:
            continue
        l2, l3, l4 = parts[0], parts[1], parts[2]
        # 知识库 md 中常见：L3 为 — 时，配置项名在 L4 列，设置选项在「配置项」列
        if l3 in ("—", "-", "") and l4 not in ("—", "-", ""):
            item, options = l4, parts[3]
        else:
            item, options = parts[3], parts[4]
        legacy, note = parts[5], parts[6]
        if item in ("—", "-", ""):
            continue
        rows.append(
            {
                "l2": l2 if l2 not in ("—", "") else "",
                "l3": l3 if l3 not in ("—", "") else "",
                "l4": l4 if l4 not in ("—", "") else "",
                "item": item.replace("\n", " / "),
                "options": options.replace("\n", "；"),
                "legacy": legacy,
                "note": note,
            },
        )
    return rows


def slug(s: str, max_len: int = 48) -> str:
    s = re.sub(r"\s+", "_", s.strip())
    s = re.sub(r"[^\w\u4e00-\u9fff\-]+", "", s, flags=re.UNICODE)
    return (s[:max_len] or "x").lower()


def domain_slug(domain: str) -> str:
    return slug(domain.replace("&", "and"))


def module_path(domain: str, l2: str, l3: str, l4: str) -> str:
    bits = [domain]
    if l2:
        bits.append(l2)
    if l3:
        bits.append(l3)
    if l4:
        bits.append(l4)
    return " / ".join(bits)


def group_key(domain: str, l2: str, l3: str) -> str:
    return f"{domain}|{l2}|{l3}"


def build_catalog_note(domain: str, l2: str, l3: str, items: list[dict]) -> str:
    title = module_path(domain, l2, l3, "")
    lines = [f"OEM 2.0 框架 · {title}", f"共 {len(items)} 项（实况面板占位，待接 ADB/USDK）", ""]
    for i, row in enumerate(items, 1):
        opt = row["options"][:120] + ("…" if len(row["options"]) > 120 else "")
        lines.append(f"{i}. {row['item']}")
        if opt and opt != "—":
            lines.append(f"   选项: {opt}")
    return "\n".join(lines)


def yaml_quote(s: str) -> str:
    if "\n" in s or ":" in s or s.startswith("'"):
        escaped = s.replace("'", "''")
        return f"'{escaped}'"
    return s


def write_module_yaml(domain: str, groups: dict[str, list[dict]]) -> Path:
    ds = domain_slug(domain)
    out = REG / f"oem20_{ds}.yaml"
    probes = []
    for gk in sorted(groups.keys()):
        _domain, l2, l3 = gk.split("|", 2)
        items = groups[gk]
        pid = f"catalog.{ds}.{slug(l2)}_{slug(l3)}"[:64]
        note = build_catalog_note(domain, l2, l3, items)
        mod = module_path(domain, l2, l3, "")
        title = l3 or l2 or domain
        probes.append(
            {
                "id": pid,
                "module": mod,
                "item": f"{title}（{len(items)} 项）",
                "display": {"type": "catalog"},
                "probe": {"kind": "static", "note": note},
                "risk": "safe",
                "enabled": True,
                "l1": domain,
            },
        )

    safe_md = re.sub(r'[<>:"/\\|?*&]', "_", domain)
    lines = [
        f"# OEM 2.0 L1: {domain}（框架占位 catalog，自动生成）",
        f"module: {domain}",
        f"frameworkRef: 03_接口与配置映射/OEMConfig_2.0_产品框架/{safe_md}.md",
        "probes:",
    ]
    for p in probes:
        lines.append(f"- id: {p['id']}")
        lines.append(f"  module: {yaml_quote(p['module'])}")
        lines.append(f"  item: {yaml_quote(p['item'])}")
        lines.append("  display:")
        lines.append("    type: catalog")
        lines.append("  probe:")
        lines.append("    kind: static")
        note = p["probe"]["note"]
        lines.append("    note: |")
        for nl in note.splitlines():
            lines.append(f"      {nl}")
        lines.append("  risk: safe")
        lines.append("  enabled: true")
        lines.append(f"  l1: {yaml_quote(domain)}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def write_layout(domain: str, probe_ids: list[str], name: str) -> Path:
    ds = domain_slug(domain)
    layout_id = f"oem20-{ds.replace('_', '-')}"
    widgets = []
    cols = 12
    w, h = 4, 3
    x, y = 0, 0
    for i, pid in enumerate(probe_ids):
        widgets.append(
            {
                "id": f"w_{pid.replace('.', '_')}",
                "probeIds": [pid],
                "x": x,
                "y": y,
                "w": w,
                "h": h,
            },
        )
        x += w
        if x + w > cols:
            x = 0
            y += h

    layout = {
        "version": 1,
        "name": f"OEM2.0 · {domain}",
        "oemModule": domain,
        "description": f"框架 L2 目录占位概览（{len(probe_ids)} 块）；细项探针逐批接入",
        "grid": {"cols": 12, "rowHeight": 76, "margin": [10, 10], "compactType": "vertical"},
        "refresh": {"globalMs": 60000, "pauseWhenHidden": True},
        "widgets": widgets,
    }
    path = LAY / f"{layout_id}.json"
    path.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def write_overview(all_domains: dict[str, list[str]]) -> Path:
    probes = []
    for domain, pids in all_domains.items():
        ds = domain_slug(domain)
        note_lines = [
            f"# {domain}",
            f"L2 目录块: {len(pids)}",
            "",
            "在布局下拉选择对应 L1 查看各 L2 配置项清单。",
            "已实现 ADB 读写的项会逐步从 catalog 拆为独立探针。",
        ]
        probes.append(
            {
                "id": f"overview.{ds}",
                "item": domain,
                "note": "\n".join(note_lines),
                "count": len(parse_domain_md(domain)),
            },
        )

    yaml_path = REG / "oem20_overview.yaml"
    lines = [
        "# OEM 2.0 八大 L1 总览",
        "module: OEMConfig 2.0 Overview",
        "probes:",
    ]
    probe_ids = []
    for p in probes:
        probe_ids.append(p["id"])
        lines.append(f"- id: {p['id']}")
        lines.append(f"  module: OEMConfig 2.0 / {p['item']}")
        lines.append(f"  item: {p['item']}（框架 {p['count']} 项）")
        lines.append("  display:")
        lines.append("    type: catalog")
        lines.append("  probe:")
        lines.append("    kind: static")
        lines.append("    note: |")
        for nl in p["note"].splitlines():
            lines.append(f"      {nl}")
        lines.append("  risk: safe")
        lines.append("  enabled: true")
        lines.append(f"  l1: {yaml_quote(p['item'])}")
    yaml_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    widgets = []
    for i, pid in enumerate(probe_ids):
        widgets.append(
            {
                "id": f"w_{pid.replace('.', '_')}",
                "probeIds": [pid],
                "x": (i % 3) * 4,
                "y": (i // 3) * 3,
                "w": 4,
                "h": 3,
            },
        )
    layout = {
        "version": 1,
        "name": "OEM2.0 · 八大模块总览",
        "description": "一次看清 2.0 全部 L1 与框架条数；点布局切换进入各域 L2 目录",
        "grid": {"cols": 12, "rowHeight": 76, "margin": [10, 10], "compactType": "vertical"},
        "refresh": {"globalMs": 120000},
        "widgets": widgets,
    }
    path = LAY / "oem20-overview.json"
    path.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def write_index_includes(extra: list[str]) -> None:
    idx = ROOT / "registry" / "index.yaml"
    text = idx.read_text(encoding="utf-8")
    includes_marker = "includes:"
    if includes_marker not in text:
        return
    base_includes = [
        "modules/network.yaml",
        "modules/oem20_network_catalog.yaml",
        "modules/oem20_overview.yaml",
    ]
    for d in DOMAINS:
        if d == "Network Configuration":
            continue
        ds = domain_slug(d)
        f = f"modules/oem20_{ds}.yaml"
        if f not in base_includes:
            base_includes.append(f)
    if "modules/_other_l1.yaml" not in base_includes:
        base_includes.append("modules/_other_l1.yaml")

    new_block = "includes:\n" + "\n".join(f"  - {x}" for x in base_includes)
    text = re.sub(r"includes:\n(?:  - .+\n)+", new_block + "\n", text)
    idx.write_text(text, encoding="utf-8")


def write_manifest_summary(counts: dict[str, int]) -> None:
    MAN.mkdir(parents=True, exist_ok=True)
    lines = [
        "# OEM 2.0 全框架覆盖（自动生成摘要）",
        "source: tools/generate_oem20_full_registry.py",
        "l1Modules:",
    ]
    total = 0
    for d in DOMAINS:
        c = counts.get(d, 0)
        total += c
        ds = domain_slug(d)
        lines.append(f"  - l1: {d}")
        lines.append(f"    frameworkItems: {c}")
        lines.append(f"    layoutId: oem20-{ds.replace('_', '-')}")
        lines.append(f"    registryModule: oem20_{ds}.yaml")
    lines.append(f"totalFrameworkItems: {total}")
    lines.append("liveProbesNote: network.yaml 等手写探针与 catalog 并存")
    (MAN / "oem20_all_l1.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    REG.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    domain_probe_ids: dict[str, list[str]] = {}

    for domain in DOMAINS:
        rows = parse_domain_md(domain)
        counts[domain] = len(rows)
        groups: dict[str, list[dict]] = defaultdict(list)
        for row in rows:
            gk = group_key(domain, row["l2"], row["l3"])
            groups[gk].append(row)
        if domain == "Network Configuration":
            # 框架 L2 目录（不覆盖手写 network.yaml / oem20-network-configuration.json）
            path = REG / "oem20_network_catalog.yaml"
            ds = domain_slug(domain)
            probes = []
            for gk in sorted(groups.keys()):
                _domain, l2, l3 = gk.split("|", 2)
                items = groups[gk]
                pid = f"catalog.{ds}.{slug(l2)}_{slug(l3)}"[:64]
                note = build_catalog_note(domain, l2, l3, items)
                mod = module_path(domain, l2, l3, "")
                title = l3 or l2 or domain
                probes.append((pid, mod, title, len(items), note))
            lines = [
                f"# OEM 2.0 Network — 框架 L2 catalog（自动生成）",
                "module: Network Configuration",
                "probes:",
            ]
            for pid, mod, title, n, note in probes:
                lines.append(f"- id: {pid}")
                lines.append(f"  module: {yaml_quote(mod)}")
                lines.append(f"  item: {yaml_quote(f'{title}（{n} 项）')}")
                lines.append("  display:")
                lines.append("    type: catalog")
                lines.append("  probe:")
                lines.append("    kind: static")
                lines.append("    note: |")
                for nl in note.splitlines():
                    lines.append(f"      {nl}")
                lines.append("  risk: safe")
                lines.append("  enabled: true")
                lines.append("  l1: Network Configuration")
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            domain_probe_ids[domain] = [p[0] for p in probes]
            layout = {
                "version": 1,
                "name": "OEM2.0 · Network（框架目录）",
                "oemModule": domain,
                "description": "111 项按 L2 分块；实况探针见 oem20-network-configuration",
                "grid": {"cols": 12, "rowHeight": 76, "margin": [10, 10], "compactType": "vertical"},
                "refresh": {"globalMs": 120000},
                "widgets": [],
            }
            x = y = 0
            for pid in domain_probe_ids[domain]:
                layout["widgets"].append(
                    {
                        "id": f"w_{pid.replace('.', '_')}",
                        "probeIds": [pid],
                        "x": x,
                        "y": y,
                        "w": 4,
                        "h": 4,
                    },
                )
                x += 4
                if x >= 12:
                    x = 0
                    y += 4
            (LAY / "oem20-network-framework.json").write_text(
                json.dumps(layout, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            continue
        path = write_module_yaml(domain, groups)
        ids = [
            line.split(": ", 1)[1]
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.startswith("- id: ")
        ]
        domain_probe_ids[domain] = ids
        write_layout(domain, ids, domain)

    write_overview(domain_probe_ids)
    write_index_includes([])
    write_manifest_summary(counts)
    print("generated", counts, "total", sum(counts.values()))


if __name__ == "__main__":
    main()
