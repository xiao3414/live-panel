# -*- coding: utf-8 -*-
"""生成八大 L1「设备实况」探针 registry + 布局 JSON（ADB/settings 直读）。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / "registry" / "modules"
LAY = ROOT / "layouts"

# probe_id, item, module suffix, runner
def s(ns: str, key: str):
    return {"kind": "adb.settings", "namespace": ns, "key": key}

def sh(cmd: str, parse=None, map_=None):
    p = {"kind": "adb.shell", "cmd": cmd}
    if parse:
        p["parse"] = parse
    if map_:
        p["map"] = map_
    return p


L1_LIVE: dict[str, list[tuple[str, str, str, dict, dict | None]]] = {
    "System Configuration": [
        ("sys.display.brightness_mode", "Auto Brightness", "Display", s("system", "screen_brightness_mode"), {"1": "自动", "0": "关"}),
        ("sys.display.brightness", "Backlight level", "Display", s("system", "screen_brightness"), None),
        ("sys.display.timeout", "Display Timeout", "Display", s("system", "screen_off_timeout"), None),
        ("sys.display.auto_rotate", "Auto Rotate", "Display", s("system", "accelerometer_rotation"), {"1": "开", "0": "关"}),
        ("sys.display.font_scale", "Display Font Size", "Display", s("system", "font_scale"), None),
        ("sys.display.stay_awake", "Stay Awake (plugged)", "Display", s("global", "stay_on_while_plugged_in"), None),
        ("sys.time.auto", "Time Model", "Date & Time", s("global", "auto_time"), {"1": "自动", "0": "手动"}),
        ("sys.time.tz_auto", "Time Zone Mode", "Date & Time", s("global", "auto_time_zone"), {"1": "自动", "0": "手动"}),
        ("sys.time.format", "Time Format 12/24", "Date & Time", s("system", "time_12_24"), None),
        ("sys.time.timezone", "Manual Time Zone", "Date & Time", sh("getprop persist.sys.timezone"), None),
        ("sys.locale", "System locale", "Locale", s("system", "system_locales"), None),
        ("sys.volume.media", "Media volume", "Sound", s("system", "volume_music"), None),
        ("sys.volume.ring", "Ring volume", "Sound", s("system", "volume_ring"), None),
        ("sys.dev_options", "Developer options enabled", "Developer", s("global", "development_settings_enabled"), {"1": "开", "0": "关"}),
        ("sys.usb.debugging", "USB debugging", "Developer", s("global", "adb_enabled"), {"1": "开", "0": "关"}),
        ("sys.model", "Device model", "System UI", sh("getprop ro.product.model"), None),
        ("sys.android_release", "Android version", "System UI", sh("getprop ro.build.version.release"), None),
        ("sys.build_id", "Build ID", "System UI", sh("getprop ro.build.display.id"), None),
    ],
    "Application Management": [
        ("app.pkg_count", "Installed packages (count)", "Install APP", sh("pm list packages | wc -l"), None),
        ("app.user_count", "User packages (count)", "Install APP", sh("pm list packages -3 | wc -l"), None),
        ("app.oemconfig", "OEMConfig package path", "Install APP", sh("pm path com.urovo.oemconfig 2>/dev/null || pm path com.urovo.oemconfig2 2>/dev/null || echo not_found"), None),
        ("app.launcher", "Default launcher", "Application", sh("cmd package resolve-activity -a android.intent.action.MAIN -c android.intent.category.HOME | grep name | head -1"), None),
    ],
    "Package Configuration": [
        ("pkg.verifier", "Package verifier", "Package", s("global", "package_verifier_enable"), None),
        ("pkg.verify_adb", "Verify ADB installs", "Package", s("global", "verifier_verify_adb_installs"), None),
        ("pkg.install_location", "Install location", "Package", s("global", "default_install_location"), None),
    ],
    "Security&Restriction": [
        ("sec.adb", "ADB Enable", "Security", s("global", "adb_enabled"), {"1": "开", "0": "关"}),
        ("sec.unknown_sources", "Unknown sources (legacy)", "Security", s("secure", "install_non_market_apps"), None),
        ("sec.show_password", "Show passwords", "Security", s("system", "show_password"), None),
        ("sec.lockscreen_disabled", "Lock screen disabled", "Security", s("secure", "lockscreen.disabled"), None),
        ("sec.lock_type", "Screen lock type", "Security", s("secure", "lockscreen.password_type"), None),
        ("sec.trust_agents", "Trust agents enabled", "Security", s("secure", "trust_agents_initialized"), None),
        ("sec.location_mode", "Location mode", "Security", s("secure", "location_mode"), None),
    ],
    "Data Capture & Peripherals": [
        ("dcp.usb", "USB configuration", "Peripherals", sh("getprop sys.usb.config"), None),
        ("dcp.usb.state", "USB state", "Peripherals", sh("getprop sys.usb.state"), None),
        ("dcp.scan_pkgs", "Scan-related packages", "Data Capture", sh("pm list packages | grep -Ei 'scan|wedge|rfid|urovo|decoder' | head -8"), None),
        ("dcp.camera_disabled", "Camera disabled policy", "Peripherals", s("secure", "camera_disabled"), None),
        ("dcp.nfc", "NFC adapter state", "NFC", sh("dumpsys nfc | grep -m1 mState", "contains", {"ON": "开", "OFF": "关"}), None),
        ("dcp.bt", "Bluetooth on", "Bluetooth", s("global", "bluetooth_on"), {"1": "开", "0": "关"}),
    ],
    "Device Maintenance": [
        ("maint.uptime", "System uptime", "Maintenance", sh("uptime"), None),
        ("maint.boot", "Boot completed", "Maintenance", sh("getprop sys.boot_completed"), None),
        ("maint.oem_log", "OEMConfig log (last)", "Maintenance", sh("logcat -d -t 100 | grep -i OEMConfig | tail -1"), None),
        ("maint.battery_level", "Battery level", "Maintenance", sh("dumpsys battery | grep level | head -1"), None),
        ("maint.free_storage", "Data partition free", "Maintenance", sh("df -h /data | tail -1"), None),
    ],
    "Profile Configuration": [
        ("prof.boot", "Boot completed", "Profile", sh("getprop sys.boot_completed"), None),
        ("prof.provisioned", "Device provisioned", "Profile", s("global", "device_provisioned"), None),
        ("prof.setup_complete", "User setup complete", "Profile", s("secure", "user_setup_complete"), None),
        ("prof.oem_unlock", "OEM unlock allowed", "Profile", s("global", "oem_unlock_allowed"), None),
    ],
}

NETWORK_LIVE_IDS = [
    "wifi.state",
    "wifi.ssid",
    "wifi.scanning",
    "wifi.notification",
    "wifi.wakeup",
    "wifi.country",
    "network.airplane",
    "network.private_dns",
    "bt.state",
    "nfc.state",
    "gps.state",
    "device.hostname",
]


def slug_domain(domain: str) -> str:
    return domain.lower().replace("&", "and").replace(" ", "-").replace("--", "-")


def yaml_probe(domain: str, pid: str, item: str, mod_suffix: str, probe: dict, labels: dict | None) -> str:
    mod = f"{domain} / {mod_suffix}"
    disp = "toggle" if labels else "text"
    lines = [
        f"- id: {pid}",
        f"  l1: {domain}",
        f"  module: {mod}",
        f"  item: {item}",
        "  display:",
        f"    type: {disp}",
        "  probe:",
    ]
    if probe["kind"] == "adb.settings":
        lines.append("    kind: adb.settings")
        lines.append(f"    namespace: {probe['namespace']}")
        lines.append(f"    key: {probe['key']}")
    else:
        lines.append("    kind: adb.shell")
        lines.append(f"    cmd: {probe['cmd']}")
        if probe.get("parse"):
            lines.append(f"    parse: {probe['parse']}")
        if probe.get("map"):
            lines.append("    map:")
            for mk, mv in probe["map"].items():
                lines.append(f"      '{mk}': '{mv}'")

    if labels:
        lines.append("  labels:")
        for lk, lv in labels.items():
            lines.append(f"    '{lk}': {lv}")
    lines.append("  write: false")
    lines.append("  risk: safe")
    lines.append("  refreshMs: 8000")
    return "\n".join(lines)


def write_live_yaml():
    chunks = ["# OEM 2.0 八大 L1 设备实况直读（自动生成，勿手改；源: tools/generate_l1_live_reads.py）", "module: OEM20 Live Reads", "probes:"]
    for domain, items in L1_LIVE.items():
        for pid, item, suffix, probe, labels in items:
            chunks.append(yaml_probe(domain, pid, item, suffix, probe, labels))
    out = REG / "oem20_live_reads.yaml"
    out.write_text("\n".join(chunks) + "\n", encoding="utf-8")
    return out


def write_layout(domain: str, probe_ids: list[str]) -> Path:
    ds = slug_domain(domain)
    lid = f"oem20-{ds}-live"
    widgets = []
    x, y, w, h, cols = 0, 0, 3, 2, 12
    for pid in probe_ids:
        widgets.append(
            {
                "id": f"w_live_{pid.replace('.', '_')}",
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
        "name": f"OEM2.0 · {domain} · 设备实况",
        "oemModule": domain,
        "description": "ADB/Settings 直读（自动刷新）；框架完整目录见「框架目录」",
        "grid": {"cols": 12, "rowHeight": 72, "margin": [10, 10], "compactType": "vertical"},
        "refresh": {"globalMs": 15000, "pauseWhenHidden": True},
        "widgets": widgets,
    }
    path = LAY / f"{lid}.json"
    path.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main():
    write_live_yaml()
    for domain in L1_LIVE:
        ids = [t[0] for t in L1_LIVE[domain]]
        write_layout(domain, ids)
    write_layout("Network Configuration", NETWORK_LIVE_IDS)
    print("ok: oem20_live_reads.yaml + *-live.json layouts")


if __name__ == "__main__":
    main()
