"""一次性：从 probes.yaml 拆出 modules/network.yaml 与 modules/_other_l1.yaml"""
from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1] / "registry"
SRC = ROOT / "probes.yaml"

NETWORK_PREFIXES = (
    "wifi.",
    "network.",
    "bt.",
    "nfc.",
    "gps.",
    "ethernet.",
)
NETWORK_IDS = {"device.hostname", "group.network_quick"}


def is_network(probe_id: str) -> bool:
    if probe_id in NETWORK_IDS:
        return True
    return probe_id.startswith(NETWORK_PREFIXES)


def main() -> None:
    data = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    probes = data.get("probes", [])
    net, other = [], []
    for p in probes:
        pid = p["id"]
        if is_network(pid):
            p = dict(p)
            p.setdefault("l1", "Network Configuration")
            net.append(p)
        else:
            other.append(p)

    (ROOT / "modules").mkdir(exist_ok=True)
    net_doc = {
        "module": "Network Configuration",
        "frameworkRef": "03_接口与配置映射/OEMConfig_2.0_产品框架/Network Configuration.md",
        "probes": net,
    }
    other_doc = {
        "module": "_other",
        "note": "非 Network L1，后续按 modules/system.yaml 等继续拆",
        "probes": other,
    }
    (ROOT / "modules" / "network.yaml").write_text(
        "# OEM 2.0 L1: Network Configuration\n"
        + yaml.dump(net_doc, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    (ROOT / "modules" / "_other_l1.yaml").write_text(
        yaml.dump(other_doc, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    print(f"network probes: {len(net)}, other: {len(other)}")


if __name__ == "__main__":
    main()
