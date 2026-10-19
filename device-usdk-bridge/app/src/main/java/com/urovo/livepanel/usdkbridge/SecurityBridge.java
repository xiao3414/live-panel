package com.urovo.livepanel.usdkbridge;

import android.content.Context;
import android.device.ApplicationManagerEx;
import android.device.DeviceManager;
import android.device.DeviceManagerEx;
import android.provider.Settings;
import android.view.KeyEvent;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Locale;

/**
 * OEM Security&Restriction 读/写（与 USDK autotest 对齐）。 GET/SET 结果写 BOOL:1/0、VAL:…、ERR:…
 */
public final class SecurityBridge {
    private SecurityBridge() {}

    public static String get(Context ctx, String feature) {
        if (feature == null || feature.isEmpty()) return "ERR:missing feature";
        UsdkLazy usdk = new UsdkLazy();
        try {
            switch (feature) {
                case "screen_lock":
                    return bool(secureInt(ctx, "lockscreen.disabled", 0) == 0);
                case "screen_lock_set":
                    return val(readLockSetType(ctx));
                case "unknown_source":
                    return bool(secureInt(ctx, "install_non_market_apps", 0) == 1);
                case "verify_apps_usb":
                    return bool(globalInt(ctx, "verifier_verify_adb_installs", 1) == 1);
                case "adb":
                    return bool(globalInt(ctx, "adb_enabled", 0) == 1);
                case "screen_lock_password":
                    return val(readLockPasswordSet(ctx) ? "set" : "");
                case "external_sd":
                    return bool(isRemovableMounted(ctx));
                case "usb_mode":
                    return val(readUsbMode(ctx, usdk));
                case "allow_factory_reset":
                    return bool(!usdk.ex().getDisableFactoryReset());
                case "google_play_protect":
                    return bool("1".equals(usdk.ex().getPackageVerifierUserConsent()));
                case "screen_lock_timeout":
                    return val(readLockScreenTimeout(ctx, usdk));
                case "scan_key_pass":
                    return bool(parseBoolString(usdk.ex().getScanKeyPassEnabled()));
                case "disallow_screenshot":
                    return bool(usdk.ex().getDisableScreenShot());
                case "screen_pinning":
                    return bool(parseBoolString(usdk.ex().getScreenPinningEnabled()));
                case "volume_key":
                    return bool(
                            usdk.ex().getKeyEnabled(KeyEvent.KEYCODE_VOLUME_UP)
                                    && usdk.ex().getKeyEnabled(KeyEvent.KEYCODE_VOLUME_DOWN));
                case "camera_access":
                    return bool(readEffectiveCameraAllowed(ctx, usdk));
                case "microphone_access":
                    return bool(usdk.ex().getMicrophoneAccessAllowed());
                case "clipboard_access":
                    return readClipboardAccess(usdk);
                case "show_passwords":
                    return bool(usdk.ex().getShowPasswordWhenTypingEnabled());
                case "location_access":
                    return bool(secureInt(ctx, "location_mode", 0) != 0);
                case "usb":
                    return bool(readUsbDataEnabled(ctx, usdk));
                default:
                    return "ERR:unknown feature " + feature;
            }
        } catch (Throwable t) {
            if (t.getMessage() != null && t.getMessage().contains("Failed resolution")) {
                return UsdkLazy.usdkErr(t);
            }
            return "ERR:" + (t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName());
        }
    }

    public static String set(Context ctx, String feature, String value) {
        if (feature == null || feature.isEmpty()) return "ERR:missing feature";
        UsdkLazy usdk = new UsdkLazy();
        boolean on =
                "on".equalsIgnoreCase(value)
                        || "1".equals(value)
                        || "true".equalsIgnoreCase(value);
        try {
            switch (feature) {
                case "screen_lock":
                    Settings.Secure.putInt(
                            ctx.getContentResolver(), "lockscreen.disabled", on ? 0 : 1);
                    return "OK";
                case "unknown_source":
                    Settings.Secure.putInt(
                            ctx.getContentResolver(), "install_non_market_apps", on ? 1 : 0);
                    return "OK";
                case "verify_apps_usb":
                    Settings.Global.putInt(
                            ctx.getContentResolver(), "verifier_verify_adb_installs", on ? 1 : 0);
                    return "OK";
                case "location_access":
                    Settings.Secure.putInt(
                            ctx.getContentResolver(), "location_mode", on ? 3 : 0);
                    return "OK";
                case "adb":
                    Settings.Global.putInt(ctx.getContentResolver(), "adb_enabled", on ? 1 : 0);
                    try {
                        usdk.dm().controlAdb(on);
                    } catch (Throwable ignored) {
                        /* Settings 已写 */
                    }
                    return "OK";
                case "allow_factory_reset":
                    usdk.ex().setDisableFactoryReset(!on);
                    return "OK";
                case "google_play_protect":
                    usdk.ex().setPackageVerifierUserConsent(on ? "1" : "-1");
                    return "OK";
                case "screen_lock_set":
                    return applyLockSet(ctx, usdk.dm(), usdk.ex(), value);
                case "screen_lock_timeout":
                    usdk.ex().setLockScreenTimeout(value != null ? value : "30000");
                    return "OK";
                case "screen_lock_password":
                    if (value == null || value.isEmpty()) return "ERR:missing password";
                    usdk.dm().saveLockPassword(value, 262144);
                    return "OK";
                case "scan_key_pass":
                    usdk.ex().setScanKeyPassEnabled(on ? "true" : "false");
                    return "OK";
                case "disallow_screenshot":
                    usdk.ex().setDisableScreenShot(on);
                    return "OK";
                case "screen_pinning":
                    usdk.ex().setScreenPinningEnabled(on ? "true" : "false");
                    return "OK";
                case "volume_key":
                    usdk.ex().setKeyEnabled(KeyEvent.KEYCODE_VOLUME_UP, on);
                    usdk.ex().setKeyEnabled(KeyEvent.KEYCODE_VOLUME_DOWN, on);
                    return "OK";
                case "camera_access":
                    usdk.ex().setCameraAccessAllowed(on);
                    return "OK";
                case "microphone_access":
                    usdk.ex().setMicrophoneAccessAllowed(on);
                    return "OK";
                case "clipboard_access":
                    return writeClipboardAccess(usdk, on);
                case "show_passwords":
                    usdk.ex().setShowPasswordWhenTypingEnabled(on);
                    return "OK";
                case "external_sd":
                    usdk.ex().enableMount(on);
                    return "OK";
                case "usb":
                    usdk.dm().controlUSB(on);
                    return "OK";
                case "usb_mode":
                    usdk.ex().setUsbMode(value != null ? value : "0");
                    return "OK";
                default:
                    return "ERR:unknown feature " + feature;
            }
        } catch (Throwable t) {
            if (t.getMessage() != null && t.getMessage().contains("Failed resolution")) {
                return UsdkLazy.usdkErr(t);
            }
            return "ERR:" + (t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName());
        }
    }

    private static String applyLockSet(Context ctx, DeviceManager dm, DeviceManagerEx ex, String value)
            throws Exception {
        if (value == null) value = "none";
        switch (value) {
            case "none":
                ex.setNoLockScreen("true");
                dm.clearLock();
                return "OK";
            case "slide":
                Settings.Secure.putInt(ctx.getContentResolver(), "lockscreen.password_type", 65536);
                return "OK";
            case "pattern":
                dm.saveLockPattern("14789");
                return "OK";
            case "pin":
                dm.saveLockPassword("1234", 262144);
                return "OK";
            default:
                return "ERR:bad lock type " + value;
        }
    }

    private static String readLockSetType(Context ctx) {
        if (secureInt(ctx, "lockscreen.disabled", 0) == 1) {
            return "none";
        }
        int pt = secureInt(ctx, "lockscreen.password_type", -1);
        if (pt == 65536) return "slide";
        if (pt == 0) return "none";
        if (pt == 131072 || pt == 262144) return "pin";
        if (pt == 196608) return "pattern";
        LockDumpsysParsed parsed = readLockDumpsysParsed();
        if (parsed.quality == 65536) return "slide";
        String mapped = mapCredentialType(parsed.credentialType);
        if ("slide".equals(mapped) || "pin".equals(mapped) || "pattern".equals(mapped)) {
            return mapped;
        }
        if (pt == -1
                && (mapped == null || "none".equals(mapped))
                && parsed.passwordHandleCount == 0) {
            return "slide";
        }
        if ("none".equals(mapped)) return "none";
        return "none";
    }

    private static boolean readLockPasswordSet(Context ctx) {
        String set = readLockSetType(ctx);
        return "pin".equals(set) || "pattern".equals(set);
    }

    private static final class LockDumpsysParsed {
        String credentialType;
        boolean hasLskfProtector;
        int passwordHandleCount;
        int quality;
    }

    private static LockDumpsysParsed readLockDumpsysParsed() {
        LockDumpsysParsed p = new LockDumpsysParsed();
        try {
            Process proc = Runtime.getRuntime().exec(new String[] {"dumpsys", "lock_settings"});
            BufferedReader r =
                    new BufferedReader(new InputStreamReader(proc.getInputStream()));
            String line;
            while ((line = r.readLine()) != null) {
                String t = line.trim();
                if (t.contains("LSKF-based SP protector ID:")) {
                    String id = t.substring(t.indexOf(':') + 1).trim();
                    if (!id.isEmpty() && !"null".equalsIgnoreCase(id)) {
                        p.hasLskfProtector = true;
                    }
                }
                if (t.startsWith("CredentialType:")) {
                    p.credentialType = t.substring("CredentialType:".length()).trim();
                }
                if (t.startsWith("PasswordHandleCount:")) {
                    try {
                        p.passwordHandleCount =
                                Integer.parseInt(
                                        t.substring("PasswordHandleCount:".length()).trim());
                    } catch (NumberFormatException ignored) {
                    }
                }
                if (t.startsWith("Quality:")) {
                    try {
                        p.quality =
                                Integer.parseInt(t.substring("Quality:".length).trim());
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
            proc.waitFor();
        } catch (Throwable ignored) {
        }
        return p;
    }

    private static boolean readLockHasLskfProtector() {
        try {
            Process p = Runtime.getRuntime().exec(new String[] {"dumpsys", "lock_settings"});
            BufferedReader r =
                    new BufferedReader(new InputStreamReader(p.getInputStream()));
            String line;
            while ((line = r.readLine()) != null) {
                if (line.contains("LSKF-based SP protector ID:")) {
                    String id = line.substring(line.indexOf(':') + 1).trim();
                    if (!id.isEmpty() && !"null".equalsIgnoreCase(id)) {
                        p.waitFor();
                        return true;
                    }
                }
            }
            p.waitFor();
        } catch (Throwable ignored) {
        }
        return false;
    }

    private static String mapCredentialType(String cred) {
        if (cred == null || cred.isEmpty()) return null;
        String t = cred.toUpperCase(Locale.US);
        if (t.contains("NONE")) return "none";
        if (t.contains("SWIPE") || t.contains("SLIDE")) return "slide";
        if (t.contains("PATTERN")) return "pattern";
        if (t.contains("PIN")) return "pin";
        if (t.contains("PASSWORD")) return "pin";
        return null;
    }

    /** OEM USBEnable：MTP/PTP 等数据传输，非 getUSBState 的「线缆/ADB 在线」 */
    private static boolean readUsbDataEnabled(Context ctx, UsdkLazy usdk) {
        try {
            String cfg = usdk.dm().getSettingProperty("sys.usb.config");
            if (cfg == null || cfg.isEmpty()) {
                cfg = usdk.dm().getSettingProperty("persist.sys.usb.config");
            }
            if (cfg != null && !cfg.isEmpty()) {
                Boolean data = usbDataEnabledFromConfig(cfg);
                if (data != null) return data;
            }
        } catch (Throwable ignored) {
        }
        try {
            return usdk.dm().getUSBState();
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static Boolean usbDataEnabledFromConfig(String cfg) {
        if (cfg == null || cfg.isEmpty()) return null;
        String c = cfg.toLowerCase(Locale.US);
        if ("none".equals(c) || "null".equals(c)) return false;
        if (c.contains("mtp")
                || c.contains("ptp")
                || c.contains("mass_storage")
                || c.contains("file_transfer")) {
            return true;
        }
        if (c.contains("charging") || c.contains("charge_only")) return false;
        if (c.contains("adb") && !c.contains("mtp") && !c.contains("ptp")) {
            return false;
        }
        return null;
    }

    private static boolean readEffectiveCameraAllowed(Context ctx, UsdkLazy usdk) {
        try {
            if (!usdk.ex().getCameraAccessAllowed()) return false;
            android.os.UserManager um =
                    (android.os.UserManager) ctx.getSystemService(Context.USER_SERVICE);
            if (um != null && um.hasUserRestriction("no_camera")) {
                return false;
            }
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static String mapLockType(int type) {
        if (type == 0) return "none";
        if (type == 65536) return "slide";
        if (type == 131072 || type == 262144) return "pin";
        if (type == 196608) return "pattern";
        return String.valueOf(type);
    }

    private static boolean hasLockCredential(Context ctx) {
        return readLockPasswordSet(ctx);
    }

    /** 与 setUsbMode(0–3) 对齐；优先 sys.usb.config（SDKAuto 同路径） */
    private static String readUsbMode(Context ctx, UsdkLazy usdk) {
        try {
            String cfg = usdk.dm().getSettingProperty("sys.usb.config");
            if (cfg == null || cfg.isEmpty()) {
                cfg = usdk.dm().getSettingProperty("persist.sys.usb.config");
            }
            if (cfg != null && !cfg.isEmpty()) {
                return mapUsbConfigToMode(cfg);
            }
        } catch (Throwable ignored) {
        }
        try {
            String prop =
                    Settings.Global.getString(ctx.getContentResolver(), "usb_mode");
            if (prop != null && !prop.isEmpty() && !"null".equals(prop)) return prop;
        } catch (Throwable ignored) {
        }
        return "0";
    }

    private static String mapUsbConfigToMode(String cfg) {
        String c = cfg.toLowerCase(java.util.Locale.US);
        if (c.contains("midi")) return "3";
        if (c.contains("ptp")) return "2";
        if (c.contains("mtp") || c.contains("mass_storage") || c.contains("file_transfer")) {
            return "1";
        }
        if (c.contains("charging") || c.contains("charge_only") || "none".equals(c)) {
            return "0";
        }
        if (c.contains("adb") && !c.contains("mtp") && !c.contains("ptp")) return "0";
        return "0";
    }

    private static String readLockScreenTimeout(Context ctx, UsdkLazy usdk) throws Throwable {
        String t = usdk.ex().getLockScreenTimeout();
        if (t != null && !t.isEmpty()) return t;
        try {
            long ms =
                    Settings.Secure.getLong(
                            ctx.getContentResolver(), "lock_screen_lock_after_timeout", -1);
            if (ms >= 0) return String.valueOf(ms);
        } catch (Throwable ignored) {
        }
        return "";
    }

    /** 允许复制粘贴 ↔ get/setClipboardDisabled（1=禁用，0=允许） */
    private static String readClipboardAccess(UsdkLazy usdk) throws Throwable {
        String dis = usdk.ex().getClipboardDisabled();
        if (dis == null || dis.isEmpty()) {
            dis = readClipboardDisabledConfig(usdk);
        }
        if (dis != null && !dis.isEmpty()) {
            return bool(!clipboardDisabledFlag(dis));
        }
        return bool(usdk.ex().isClipboardAccessNotificationEnabled());
    }

    private static String readClipboardDisabledConfig(UsdkLazy usdk) {
        try {
            String[] keys =
                    new String[] {
                        "clipboard_disabled",
                        "ClipboardDisabled",
                        "clipboard_disable",
                    };
            for (String k : keys) {
                String v = usdk.ex().getSystemConfig(k);
                if (v != null && !v.isEmpty()) return v;
            }
        } catch (Throwable ignored) {
        }
        return "";
    }

    private static String writeClipboardAccess(UsdkLazy usdk, boolean allow)
            throws Throwable {
        if (!BuildConfig.USDK_OEM_SIGN) {
            return "ERR:need_urovo_sign";
        }
        String target = allow ? "0" : "1";
        usdk.ex().setClipboardDisabled(target);
        String dis = usdk.ex().getClipboardDisabled();
        if (dis == null || dis.isEmpty()) {
            dis = readClipboardDisabledConfig(usdk);
        }
        if (dis != null && !dis.isEmpty()) {
            if (!clipboardDisabledFlag(dis) == allow) return "OK";
            return "ERR:write_no_effect";
        }
        return "OK";
    }

    private static boolean isRemovableMounted(Context ctx) {
        try {
            android.os.storage.StorageManager sm =
                    (android.os.storage.StorageManager)
                            ctx.getSystemService(Context.STORAGE_SERVICE);
            if (sm == null) return false;
            for (android.os.storage.StorageVolume vol : sm.getStorageVolumes()) {
                if (vol != null && vol.isRemovable() && "mounted".equalsIgnoreCase(vol.getState())) {
                    return true;
                }
            }
        } catch (Throwable ignored) {
        }
        return false;
    }

    private static int secureInt(Context ctx, String key, int def) {
        return Settings.Secure.getInt(ctx.getContentResolver(), key, def);
    }

    private static int globalInt(Context ctx, String key, int def) {
        return Settings.Global.getInt(ctx.getContentResolver(), key, def);
    }

    private static boolean parseBoolString(String s) {
        return "true".equalsIgnoreCase(s) || "1".equals(s);
    }

    /** getClipboardDisabled：1/true 表示剪贴板被禁用 */
    private static boolean clipboardDisabledFlag(String s) {
        if (s == null || s.isEmpty()) return false;
        return "1".equals(s) || "true".equalsIgnoreCase(s);
    }

    private static String bool(boolean v) {
        return v ? "BOOL:1" : "BOOL:0";
    }

    private static String val(String v) {
        return "VAL:" + (v == null ? "" : v);
    }
}
