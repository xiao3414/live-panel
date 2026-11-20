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
                case "glove_mode":
                    return bool(usdk.ex().getGloveMode());
                case "do_not_disturb":
                    return bool(usdk.ex().isDoNotDisturbEnabled());
                case "notification_badging":
                    return bool(parseBoolString(usdk.ex().getNotificationBadgingEnabled()));
                case "notification_light_pulse":
                    return bool(parseBoolString(usdk.ex().getNotificationLightPulseEnabled()));
                case "fixed_volume":
                    return bool(parseBoolString(usdk.ex().getFixedVolumeEnabled()));
                case "charging_sounds":
                    return bool(parseBoolString(usdk.ex().getChargingSoundsEnabled()));
                case "screen_rotation":
                    return val(screenRotationToOem(usdk.ex().getScreenRotation()));
                case "orientation_suggestion":
                    // OEM Enable = 允许方向建议；USDK 为 Disabled 开关，需取反
                    return bool(!parseBoolString(usdk.ex().getOrientationSuggestionDisabled()));
                case "auto_pop_input_method":
                    return bool(usdk.dm().getAutoPopInputMethod());
                case "default_input_method":
                    return val(usdk.ex().getDefaultInputMethod());
                case "spell_checker":
                    return bool(parseBoolString(usdk.ex().getSpellCheckerEnabled()));
                case "pointer_speed":
                    return val(usdk.ex().getPointerSpeed());
                case "disable_pop_softinput":
                    return bool(parseBoolString(usdk.ex().getDisablePopSoftinput()));
                case "keyboard_floating_window":
                    return bool(parseBoolString(usdk.ex().getKeyboardFloatingWindow()));
                case "fn_key_control_softinput":
                    return bool(parseBoolString(usdk.ex().getFnKeyControlSoftInput()));
                case "disable_imi":
                    return val(usdk.ex().getDisableImi());
                case "system_language":
                    return val(usdk.ex().getSystemLanguage());
                case "left_key":
                    return bool(usdk.dm().getLeftKeyEnabled());
                case "home_key":
                    return bool(usdk.dm().getHomeKeyEnabled());
                case "right_key":
                    return bool(usdk.dm().getRightKeyEnabled());
                case "hide_navigation_bar":
                    // OEM Enable=隐藏；USDK getBottomBarEnable true=显示导航栏 → 取反
                    return bool(!parseBoolString(usdk.ex().getBottomBarEnable()));
                case "status_bar_dropdown":
                    return readStatusBarEnabled(ctx, usdk);
                case "side_app_bar":
                    return bool(usdk.ex().getSideAppBarStatus());
                case "side_app_bar_left":
                    return val(usdk.ex().isSideAppBarLeft() ? "Left" : "Right");
                case "multi_finger_screenshot":
                    return bool(parseBoolString(usdk.ex().getMultiFingerScreenShotEnabled()));
                case "quickly_open_camera":
                    return bool(usdk.ex().getQuicklyOpenCameraStatus());
                case "gesture_navigation": {
                    boolean gestural = usdk.ex().getGestureNavigationEnabled();
                    return val(
                            gestural ? "Gesture navigation" : "3- button navigation");
                }
                case "long_press_power_assistant": {
                    boolean assistant = usdk.ex().getLongPressPowerForAssistant();
                    return val(assistant ? "Digital assistant" : "Access power menu");
                }
                case "battery_percent":
                    return bool(parseBoolString(usdk.ex().getBatteryPercentVisible()));
                case "power_save_mode":
                    return bool(parseBoolString(usdk.ex().getPowerSaveModeEnabled()));
                case "charging_optimization":
                    // OEM On/Off；USDK getBatteryWorkMode "0"=智能充电
                    return val(batteryWorkModeToChargingOptimization(usdk.ex().getBatteryWorkMode()));
                case "smart_charging":
                    // OEM Enable/Disable；同上 "0"=智能充电
                    return bool(isSmartChargingWorkMode(usdk.ex().getBatteryWorkMode()));
                case "charge_limit_percent":
                    return val(readChargeLimitPercent(usdk));
                case "battery_health_threshold":
                    return val(String.valueOf(usdk.ex().getBatteryHealthRetirementThreshold()));
                case "battery_cycle_threshold":
                    return val(String.valueOf(usdk.ex().getBatteryCycleRetirementThreshold()));
                case "battery_temp_threshold":
                    return val(String.valueOf(usdk.ex().getBatteryHighTemperatureThreshold()));
                case "battery_monitor_service":
                    return bool(usdk.ex().getBatteryMonitorServiceEnabled());
                case "battery_tip":
                    return bool(usdk.ex().getBatteryRetirementTipEnabled());
                case "left_scan_wakeup":
                    return bool(parseBoolString(usdk.ex().getLeftScanKeyWakeup()));
                case "right_scan_wakeup":
                    return bool(parseBoolString(usdk.ex().getRightScanKeyWakeup()));
                case "ptt_wakeup":
                    return bool(parseBoolString(usdk.ex().getPttKeyWakeupEnabled()));
                case "private_dns_mode":
                    return val(privateDnsModeToOem(usdk.ex().getPrivateDns()));
                case "private_dns_hostname":
                    return val(privateDnsHostnameFromRaw(usdk.ex().getPrivateDns()));
                case "net_hostname":
                    return val(usdk.ex().getNetHostname());
                case "device_name":
                    return val(readDeviceName(ctx));
                case "ethernet_enable":
                    return bool(parseBoolString(usdk.ex().getEthernetEnabled()));
                case "location_mode_switch":
                    // Network GPS：优先 USDK；本机 getLocationModeEnabled 可能与 Settings 不一致
                    return readGpsLocationEnabled(ctx, usdk);
                case "bluetooth_switch":
                    return bool(usdk.ex().getSwitchStatus("Bluetooth"));
                case "nfc_switch":
                    return bool(usdk.ex().getSwitchStatus("NFC"));
                case "airplane_mode":
                    return readAirplaneEnabled(ctx, usdk);
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
                case "glove_mode":
                    usdk.ex().setGloveMode(on);
                    return "OK";
                case "do_not_disturb":
                    usdk.ex().setDoNotDisturbEnabled(on);
                    return "OK";
                case "notification_badging":
                    usdk.ex().setNotificationBadgingEnabled(on ? "1" : "0");
                    return "OK";
                case "notification_light_pulse":
                    usdk.ex().setNotificationLightPulseEnabled(on ? "1" : "0");
                    return "OK";
                case "fixed_volume":
                    usdk.ex().setFixedVolumeEnabled(on ? "1" : "0");
                    return "OK";
                case "charging_sounds":
                    usdk.ex().setChargingSoundsEnabled(on ? "1" : "0");
                    return "OK";
                case "screen_rotation": {
                    String rot = oemToScreenRotation(value);
                    if (rot == null) return "ERR:bad screen_rotation " + value;
                    usdk.ex().setScreenRotation(rot);
                    return "OK";
                }
                case "orientation_suggestion":
                    // on=启用建议 → Disabled=false
                    usdk.ex().setOrientationSuggestionDisabled(on ? "false" : "true");
                    return "OK";
                case "auto_pop_input_method":
                    usdk.dm().setAutoPopInputMethod(on);
                    return "OK";
                case "default_input_method":
                    if (value == null || value.isEmpty()) return "ERR:missing ime id";
                    usdk.ex().setDefaultInputMethod(value.trim());
                    return "OK";
                case "spell_checker":
                    usdk.ex().setSpellCheckerEnabled(on ? "1" : "0");
                    return "OK";
                case "pointer_speed":
                    if (value == null || value.isEmpty()) return "ERR:missing pointer_speed";
                    usdk.ex().setPointerSpeed(value.trim());
                    return "OK";
                case "disable_pop_softinput":
                    usdk.ex().setDisablePopSoftinput(on ? "1" : "0");
                    return "OK";
                case "keyboard_floating_window":
                    usdk.ex().setKeyboardFloatingWindow(on ? "1" : "0");
                    return "OK";
                case "fn_key_control_softinput":
                    usdk.ex().setFnKeyControlSoftInput(on ? "1" : "0");
                    return "OK";
                case "disable_imi": {
                    String payload = oemToDisableImiPayload(value);
                    if (payload == null) return "ERR:bad disable_imi " + value;
                    usdk.ex().setDisableImi(payload);
                    return "OK";
                }
                case "system_language":
                    if (value == null || value.isEmpty()) return "ERR:missing language";
                    usdk.ex().setSystemLanguage(value.trim());
                    return "OK";
                case "left_key":
                    usdk.dm().setLeftKeyEnabled(on);
                    return "OK";
                case "home_key":
                    usdk.dm().enableHomeKey(on);
                    return "OK";
                case "right_key":
                    usdk.dm().setRightKeyEnabled(on);
                    return "OK";
                case "hide_navigation_bar":
                    // OEM Enable=隐藏 → setBottomBarEnable(false)
                    usdk.ex().setBottomBarEnable(!on);
                    return "OK";
                case "status_bar_dropdown":
                    usdk.dm().enableStatusBar(on);
                    return "OK";
                case "side_app_bar":
                    usdk.ex().enableSideAppBar(on);
                    return "OK";
                case "side_app_bar_left": {
                    String pos = value != null ? value.trim() : "";
                    boolean left =
                            "Left".equalsIgnoreCase(pos)
                                    || "left".equalsIgnoreCase(pos)
                                    || "1".equals(pos)
                                    || "true".equalsIgnoreCase(pos);
                    if ("Right".equalsIgnoreCase(pos) || "0".equals(pos)) left = false;
                    usdk.ex().setSideAppBarLeft(left);
                    return "OK";
                }
                case "multi_finger_screenshot":
                    usdk.ex().setMultiFingerScreenShotEnabled(on ? "1" : "0");
                    return "OK";
                case "quickly_open_camera":
                    usdk.ex().enableQuicklyOpenCamera(on);
                    return "OK";
                case "gesture_navigation": {
                    String v = value != null ? value.trim() : "";
                    boolean gestural =
                            v.toLowerCase(Locale.US).contains("gesture")
                                    || "1".equals(v)
                                    || "true".equalsIgnoreCase(v);
                    if (v.toLowerCase(Locale.US).contains("3-")
                            || v.toLowerCase(Locale.US).contains("button")) {
                        gestural = false;
                    }
                    usdk.ex().setGestureNavigationEnabled(gestural);
                    return "OK";
                }
                case "long_press_power_assistant": {
                    String v = value != null ? value.trim() : "";
                    boolean assistant =
                            v.toLowerCase(Locale.US).contains("assistant")
                                    || v.toLowerCase(Locale.US).contains("digital")
                                    || "1".equals(v)
                                    || "true".equalsIgnoreCase(v);
                    if (v.toLowerCase(Locale.US).contains("power menu")
                            || v.toLowerCase(Locale.US).contains("access power")) {
                        assistant = false;
                    }
                    usdk.ex().setLongPressPowerForAssistant(assistant);
                    return "OK";
                }
                case "battery_percent":
                    usdk.ex().setBatteryPercentVisible(on ? "1" : "0");
                    return "OK";
                case "power_save_mode":
                    usdk.ex().setPowerSaveModeEnabled(on ? "true" : "false");
                    return "OK";
                case "charging_optimization":
                case "smart_charging": {
                    // On/Enable → "0" 智能充电；Off/Disable → "1" 普通充电
                    usdk.ex().setBatteryWorkMode(on ? "0" : "1");
                    return "OK";
                }
                case "charge_limit_percent": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing charge_limit_percent";
                    }
                    writeChargeLimitPercent(usdk, value.trim());
                    return "OK";
                }
                case "battery_health_threshold": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing battery_health_threshold";
                    }
                    usdk.ex().setBatteryHealthRetirementThreshold(Integer.parseInt(value.trim()));
                    return "OK";
                }
                case "battery_cycle_threshold": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing battery_cycle_threshold";
                    }
                    usdk.ex().setBatteryCycleRetirementThreshold(Integer.parseInt(value.trim()));
                    return "OK";
                }
                case "battery_temp_threshold": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing battery_temp_threshold";
                    }
                    usdk.ex().setBatteryHighTemperatureThreshold(Integer.parseInt(value.trim()));
                    return "OK";
                }
                case "battery_monitor_service":
                    usdk.ex().setBatteryMonitorServiceEnabled(on);
                    return "OK";
                case "battery_tip":
                    usdk.ex().setBatteryRetirementTipEnabled(on);
                    return "OK";
                case "left_scan_wakeup":
                    usdk.ex().setLeftScanKeyWakeup(on ? "true" : "false");
                    return "OK";
                case "right_scan_wakeup":
                    usdk.ex().setRightScanKeyWakeup(on ? "true" : "false");
                    return "OK";
                case "ptt_wakeup":
                    usdk.ex().setPttKeyWakeupEnabled(on ? "true" : "false");
                    return "OK";
                case "private_dns_mode": {
                    String existingHost = "";
                    try {
                        existingHost = privateDnsHostnameFromRaw(usdk.ex().getPrivateDns());
                    } catch (Throwable ignored) {
                    }
                    String payload = oemToPrivateDnsPayload(value, existingHost);
                    if (payload == null) return "ERR:bad private_dns_mode " + value;
                    usdk.ex().setPrivateDns(payload);
                    return "OK";
                }
                case "private_dns_hostname": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing private_dns_hostname";
                    }
                    usdk.ex().setPrivateDns("2-" + value.trim());
                    return "OK";
                }
                case "net_hostname": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing net_hostname";
                    }
                    usdk.ex().setNetHostname(value.trim());
                    return "OK";
                }
                case "device_name": {
                    if (value == null || value.trim().isEmpty()) {
                        return "ERR:missing device_name";
                    }
                    // mode=1：仅设备名称（含 Settings DEVICE_NAME）
                    usdk.ex().setDeviceName(value.trim(), 1);
                    return "OK";
                }
                case "ethernet_enable":
                    usdk.ex().setEthernetEnabled(on ? "1" : "0");
                    return "OK";
                case "location_mode_switch":
                    usdk.ex().setLocationModeEnabled(on ? "1" : "0");
                    return "OK";
                case "bluetooth_switch":
                    usdk.ex().controlSwitchPolicy("Bluetooth", on, 0);
                    return "OK";
                case "nfc_switch":
                    usdk.ex().controlSwitchPolicy("NFC", on, 0);
                    return "OK";
                case "airplane_mode":
                    usdk.ex().setAirplaneModeEnabled(on ? "1" : "0");
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

    /**
     * enableStatusBar 无官方 get。读取顺序：
     * 1) getSystemConfig("status_bar_enable")（SDKAuto 同路径）
     * 2) Settings.System UROVO_STATUSBAR_ENABLE（bit 0x10000 = DISABLE_EXPAND）
     */
    private static String readStatusBarEnabled(Context ctx, UsdkLazy usdk) {
        try {
            String cfg = usdk.ex().getSystemConfig("status_bar_enable");
            if (cfg != null && !cfg.isEmpty() && !"null".equalsIgnoreCase(cfg)) {
                // "0"/"false" = 禁用下拉；其它视为允许
                boolean enabled =
                        !("0".equals(cfg.trim())
                                || "false".equalsIgnoreCase(cfg.trim()));
                return bool(enabled);
            }
        } catch (Throwable ignored) {
        }
        try {
            // StatusBarManager.DISABLE_EXPAND = 0x00010000
            int flags =
                    Settings.System.getInt(
                            ctx.getContentResolver(), "UROVO_STATUSBAR_ENABLE", 0);
            boolean expandDisabled = (flags & 0x00010000) != 0;
            return bool(!expandDisabled);
        } catch (Throwable ignored) {
        }
        try {
            Object dm = usdk.dm();
            for (String name :
                    new String[] {
                        "getStatusBarEnabled", "isStatusBarEnabled", "getStatusBarEnable"
                    }) {
                try {
                    java.lang.reflect.Method m = dm.getClass().getMethod(name);
                    Object r = m.invoke(dm);
                    if (r instanceof Boolean) return bool((Boolean) r);
                    if (r != null) return bool(parseBoolString(String.valueOf(r)));
                } catch (NoSuchMethodException ignored) {
                }
            }
        } catch (Throwable ignored) {
        }
        return "ERR:status_bar_get_unavailable";
    }

    /**
     * OEM Disable Input Method：Clear → 0；Add → 1-包名；Cancel → 2-包名。
     * 已是 0 / 1-… / 2-… 则原样。
     */
    private static String oemToDisableImiPayload(String value) {
        if (value == null) return null;
        String t = value.trim();
        if (t.isEmpty()) return null;
        if ("0".equals(t)
                || "Clear disabled".equalsIgnoreCase(t)
                || "clear".equalsIgnoreCase(t)) {
            return "0";
        }
        if (t.startsWith("1-") || t.startsWith("2-")) return t;
        if (t.toLowerCase(Locale.US).startsWith("add")) {
            // 「Add disabled」需带包名；单独动作不够
            return null;
        }
        if (t.toLowerCase(Locale.US).startsWith("cancel")) return null;
        // 纯包名 → 默认 Add disabled
        return "1-" + t;
    }

    /** USDK 0/1/2/3 → OEM 0°/90°/180°/270° */
    private static String screenRotationToOem(String raw) {
        if (raw == null) return "";
        String t = raw.trim();
        if ("0".equals(t) || "0°".equals(t)) return "0°";
        if ("1".equals(t) || "90".equals(t) || "90°".equals(t)) return "90°";
        if ("2".equals(t) || "180".equals(t) || "180°".equals(t)) return "180°";
        if ("3".equals(t) || "270".equals(t) || "270°".equals(t)) return "270°";
        return t;
    }

    /** OEM/文案 → USDK 0–3；无法识别返回 null */
    private static String oemToScreenRotation(String value) {
        if (value == null) return null;
        String t = value.trim();
        if ("0".equals(t) || "0°".equals(t) || "0度".equals(t)) return "0";
        if ("1".equals(t) || "90".equals(t) || "90°".equals(t) || "90度".equals(t)) return "1";
        if ("2".equals(t) || "180".equals(t) || "180°".equals(t) || "180度".equals(t)) return "2";
        if ("3".equals(t) || "270".equals(t) || "270°".equals(t) || "270度".equals(t)) return "3";
        return null;
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
                                Integer.parseInt(t.substring("Quality:".length()).trim());
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

    /**
     * USDK getPrivateDns：\"0\" 关 / \"1\" 自动 / \"2-host\" 指定主机 → OEM 文案。
     */
    private static String privateDnsModeToOem(String raw) {
        if (raw == null) return "";
        String t = raw.trim();
        if (t.startsWith("2-") || t.startsWith("2")) {
            return "Private DNS Provider Hostname";
        }
        if ("1".equals(t) || "opportunistic".equalsIgnoreCase(t) || "auto".equalsIgnoreCase(t)) {
            return "Auto";
        }
        if ("0".equals(t)
                || "off".equalsIgnoreCase(t)
                || "closed".equalsIgnoreCase(t)
                || "false".equalsIgnoreCase(t)) {
            return "Closed";
        }
        if (t.toLowerCase(Locale.US).contains("hostname")
                || t.toLowerCase(Locale.US).contains("provider")) {
            return "Private DNS Provider Hostname";
        }
        return t;
    }

    private static String privateDnsHostnameFromRaw(String raw) {
        if (raw == null) return "";
        String t = raw.trim();
        if (t.startsWith("2-") && t.length() > 2) return t.substring(2).trim();
        return "";
    }

    /** OEM Closed/Auto/Hostname → USDK 0 / 1 / 2-host（无 host 时仅 2-） */
    private static String oemToPrivateDnsPayload(String value, String hostname) {
        if (value == null) return null;
        String t = value.trim();
        if (t.isEmpty()) return null;
        if ("0".equals(t)
                || "Closed".equalsIgnoreCase(t)
                || "off".equalsIgnoreCase(t)
                || "false".equalsIgnoreCase(t)) {
            return "0";
        }
        if ("1".equals(t)
                || "Auto".equalsIgnoreCase(t)
                || "Automatic".equalsIgnoreCase(t)
                || "opportunistic".equalsIgnoreCase(t)) {
            return "1";
        }
        if ("2".equals(t)
                || t.equalsIgnoreCase("Private DNS Provider Hostname")
                || t.toLowerCase(Locale.US).contains("hostname")
                || t.toLowerCase(Locale.US).contains("provider")) {
            String host = hostname != null ? hostname.trim() : "";
            return host.isEmpty() ? "2-" : ("2-" + host);
        }
        if (t.startsWith("2-")) return t;
        return null;
    }

    private static String readDeviceName(Context ctx) {
        try {
            String name =
                    Settings.Global.getString(ctx.getContentResolver(), Settings.Global.DEVICE_NAME);
            if (name != null && !name.trim().isEmpty()) return name.trim();
        } catch (Throwable ignored) {
        }
        try {
            String bt =
                    Settings.Secure.getString(ctx.getContentResolver(), "bluetooth_name");
            if (bt != null && !bt.trim().isEmpty()) return bt.trim();
        } catch (Throwable ignored) {
        }
        return android.os.Build.MODEL != null ? android.os.Build.MODEL : "";
    }

    /**
     * Network GPS：库注 controlSwitchPolicy(Location) / setLocationModeEnabled。
     * 读序：getLocationModeEnabled → Settings location_mode → getSwitchStatus(Location)
     */
    private static String readGpsLocationEnabled(Context ctx, UsdkLazy usdk) {
        try {
            String v = usdk.ex().getLocationModeEnabled();
            if (v != null && !v.trim().isEmpty()) {
                String t = v.trim();
                if (parseBoolString(t)) return bool(true);
                // 部分机型回显非 0/1；仅明确关才采信
                if ("0".equals(t) || "false".equalsIgnoreCase(t) || "off".equalsIgnoreCase(t)) {
                    /* fall through 与 Settings 交叉核对 */
                } else if (!"null".equalsIgnoreCase(t)) {
                    return bool(true);
                }
            }
        } catch (Throwable ignored) {
        }
        try {
            int mode = Settings.Secure.getInt(ctx.getContentResolver(), "location_mode", 0);
            if (mode != 0) return bool(true);
        } catch (Throwable ignored) {
        }
        try {
            return bool(usdk.ex().getSwitchStatus("Location"));
        } catch (Throwable ignored) {
        }
        return bool(false);
    }

    private static String readAirplaneEnabled(Context ctx, UsdkLazy usdk) {
        try {
            String v = usdk.ex().getAirplaneModeEnabled();
            if (v != null && !v.trim().isEmpty()) {
                if (parseBoolString(v.trim())) return bool(true);
                if ("0".equals(v.trim()) || "false".equalsIgnoreCase(v.trim())) {
                    /* 与 Settings 交叉 */
                } else {
                    return bool(true);
                }
            }
        } catch (Throwable ignored) {
        }
        try {
            int on = Settings.Global.getInt(ctx.getContentResolver(), "airplane_mode_on", 0);
            return bool(on != 0);
        } catch (Throwable ignored) {
        }
        return bool(false);
    }

    /** USDK BatteryWorkMode："0"=智能充电 / "1"=普通充电 / "3"=延迟充电 */
    private static boolean isSmartChargingWorkMode(String mode) {
        return mode != null && "0".equals(mode.trim());
    }

    private static String batteryWorkModeToChargingOptimization(String mode) {
        return isSmartChargingWorkMode(mode) ? "on" : "off";
    }

    /**
     * 充电上限：文档与 SDKAuto 走 DeviceManagerEx；本机 jar 亦可能在 DeviceManager。
     */
    private static String readChargeLimitPercent(UsdkLazy usdk) throws Throwable {
        try {
            java.lang.reflect.Method m =
                    usdk.ex().getClass().getMethod("getChargeLimitPercent");
            Object r = m.invoke(usdk.ex());
            if (r != null) {
                String s = String.valueOf(r).trim();
                if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) return s;
            }
        } catch (Throwable ignored) {
        }
        String dm = usdk.dm().getChargeLimitPercent();
        return dm != null ? dm.trim() : "";
    }

    private static void writeChargeLimitPercent(UsdkLazy usdk, String percent) throws Throwable {
        try {
            java.lang.reflect.Method m =
                    usdk.ex().getClass().getMethod("setChargeLimitPercent", String.class);
            m.invoke(usdk.ex(), percent);
            return;
        } catch (Throwable ignored) {
        }
        usdk.dm().setChargeLimitPercent(percent);
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
