package com.urovo.livepanel.usdkbridge;

import android.device.DeviceManagerEx;
import java.lang.reflect.Method;

/** Docking Station：Bottom/Back Host + Ethernet IP/Proxy（DeviceManagerEx） */
public final class DockingBridge {
    private DockingBridge() {}

    static String dumpAll() {
        StringBuilder sb = new StringBuilder("DOCKPROPS:");
        UsdkLazy usdk = new UsdkLazy();
        try {
            DeviceManagerEx ex = usdk.ex();
            // na = API 不存在 / 调用失败，与明确返回 false(0) 区分；部分机型无背部 Host
            append(sb, "bottomHost", host01OrNa(ex, "getBottomHostModeStatus"));
            append(sb, "backHost", host01OrNa(ex, "getBackHostModeStatus"));
            append(sb, "ethernet", ethEnabled01(invokeString(ex, "getEthernetEnabled")));

            // 系统实况优先：dumpsys ethernet 的 IP assignment（USDK 常残留上次静态字段且 mode 不准）
            String dumpsysMode = readDumpsysIpAssignment();
            Object ip = invokeObj(ex, "getEthernetIpSettings");
            if (ip != null) {
                String usdkMode = assignmentMode(ip);
                append(
                        sb,
                        "ipMode",
                        dumpsysMode != null && !dumpsysMode.isEmpty() ? dumpsysMode : usdkMode);
                append(sb, "ipAddress", strField(ip, "getIpAddress"));
                append(sb, "gateway", strField(ip, "getGateway"));
                append(sb, "netmask", prefixToNetmask(intField(ip, "getPrefixLength")));
                append(sb, "prefixLength", String.valueOf(intField(ip, "getPrefixLength")));
                append(sb, "dns1", strField(ip, "getDns1"));
                append(sb, "dns2", strField(ip, "getDns2"));
            } else {
                append(sb, "ipMode", dumpsysMode != null ? dumpsysMode : "");
                append(sb, "ipAddress", "");
                append(sb, "gateway", "");
                append(sb, "netmask", "");
                append(sb, "prefixLength", "");
                append(sb, "dns1", "");
                append(sb, "dns2", "");
            }

            Object proxy = invokeObj(ex, "getEthernetProxySettings");
            if (proxy != null) {
                append(sb, "proxyHost", strField(proxy, "getHost", "getHostname"));
                append(sb, "proxyPort", strField(proxy, "getPort", "getProxyPort"));
                append(sb, "proxyBypass", strField(proxy, "getExclusionList", "getBypass"));
            } else {
                append(sb, "proxyHost", "");
                append(sb, "proxyPort", "");
                append(sb, "proxyBypass", "");
            }
            return sb.toString();
        } catch (Throwable t) {
            return UsdkLazy.usdkErr(t);
        }
    }

    static String getField(String name) {
        if (name == null || name.isEmpty()) return "ERR:missing field";
        String dump = dumpAll();
        if (dump.startsWith("ERR:")) return dump;
        String key = name.trim();
        for (String row : dump.substring("DOCKPROPS:".length()).split("\n")) {
            int eq = row.indexOf('=');
            if (eq <= 0) continue;
            if (row.substring(0, eq).equals(key)) {
                return "VAL:" + row.substring(eq + 1);
            }
        }
        return "ERR:not found " + key;
    }

    /**
     * 写回：extras 中非空字段才下发。
     * bottomHost/backHost/ethernet: 0|1|true|false|enable|disable
     * ipMode: DHCP|Static；静态时带 ipAddress/gateway/netmask|prefixLength/dns1/dns2
     * proxyHost/proxyPort/proxyBypass；proxyRestore=1 调 restoreEthernetProxyDefault
     */
    static String apply(android.content.Intent intent) {
        if (intent == null) return "ERR:missing intent";
        UsdkLazy usdk = new UsdkLazy();
        try {
            DeviceManagerEx ex = usdk.ex();
            String bottom = trimExtra(intent, "bottomHost");
            if (bottom != null) {
                Boolean on = parse01(bottom);
                if (on == null) return "ERR:bad bottomHost";
                invokeVoidBool(ex, "enableBottomHostMode", on);
            }
            String back = trimExtra(intent, "backHost");
            if (back != null) {
                Boolean on = parse01(back);
                if (on == null) return "ERR:bad backHost";
                invokeVoidBool(ex, "enableBackHostMode", on);
            }
            String eth = trimExtra(intent, "ethernet");
            if (eth != null) {
                Boolean on = parse01(eth);
                if (on == null) return "ERR:bad ethernet";
                invokeVoidString(ex, "setEthernetEnabled", on ? "true" : "false");
            }

            String ipMode = trimExtra(intent, "ipMode");
            boolean touchIp =
                    ipMode != null
                            || trimExtra(intent, "ipAddress") != null
                            || trimExtra(intent, "gateway") != null
                            || trimExtra(intent, "netmask") != null
                            || trimExtra(intent, "prefixLength") != null
                            || trimExtra(intent, "dns1") != null
                            || trimExtra(intent, "dns2") != null;
            if (touchIp) {
                Object settings =
                        buildIpSettings(
                                ipMode,
                                trimExtra(intent, "ipAddress"),
                                trimExtra(intent, "gateway"),
                                trimExtra(intent, "netmask"),
                                trimExtra(intent, "prefixLength"),
                                trimExtra(intent, "dns1"),
                                trimExtra(intent, "dns2"));
                invokeVoidObj(ex, "setEthernetIpSettings", settings);
            }

            String proxyRestore = trimExtra(intent, "proxyRestore");
            if (proxyRestore != null && parse01(proxyRestore) == Boolean.TRUE) {
                invokeVoid(ex, "restoreEthernetProxyDefault");
            } else {
                boolean touchProxy =
                        trimExtra(intent, "proxyHost") != null
                                || trimExtra(intent, "proxyPort") != null
                                || trimExtra(intent, "proxyBypass") != null;
                if (touchProxy) {
                    Object proxy =
                            buildProxySettings(
                                    trimExtra(intent, "proxyHost"),
                                    trimExtra(intent, "proxyPort"),
                                    trimExtra(intent, "proxyBypass"));
                    invokeVoidObj(ex, "setEthernetProxySettings", proxy);
                }
            }
            return "OK";
        } catch (Throwable t) {
            return UsdkLazy.usdkErr(t);
        }
    }

    private static String trimExtra(android.content.Intent intent, String key) {
        String v = intent.getStringExtra(key);
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }

    private static Boolean parse01(String raw) {
        String t = raw.trim().toLowerCase();
        if (t.equals("1") || t.equals("true") || t.equals("enable") || t.equals("enabled") || t.equals("on")) {
            return true;
        }
        if (t.equals("0") || t.equals("false") || t.equals("disable") || t.equals("disabled") || t.equals("off")) {
            return false;
        }
        return null;
    }

    private static Object buildIpSettings(
            String ipMode,
            String ip,
            String gateway,
            String netmask,
            String prefixLength,
            String dns1,
            String dns2)
            throws Exception {
        Class<?> cls = Class.forName("com.ubx.usdkplus.EthernetIpSettings");
        Object builder = cls.getMethod("builder").invoke(null);
        Class<?> builderCls = builder.getClass();
        String modeName =
                ipMode != null && ipMode.toUpperCase().contains("STATIC") ? "STATIC" : "DHCP";
        if (ipMode == null && (ip != null || gateway != null || netmask != null || prefixLength != null)) {
            modeName = "STATIC";
        }
        Class<?> modeCls = Class.forName("com.ubx.usdkplus.EthernetIpSettings$AssignmentMode");
        @SuppressWarnings({"unchecked", "rawtypes"})
        Object modeEnum = Enum.valueOf((Class<Enum>) modeCls, modeName);
        builder = builderCls.getMethod("mode", modeCls).invoke(builder, modeEnum);
        if ("STATIC".equals(modeName)) {
            if (ip != null) builder = builderCls.getMethod("ipAddress", String.class).invoke(builder, ip);
            if (gateway != null) builder = builderCls.getMethod("gateway", String.class).invoke(builder, gateway);
            int prefix = -1;
            if (prefixLength != null) {
                try {
                    prefix = Integer.parseInt(prefixLength.trim());
                } catch (NumberFormatException ignored) {
                    prefix = -1;
                }
            }
            if (prefix < 0 && netmask != null) prefix = netmaskToPrefix(netmask);
            if (prefix >= 0) {
                builder = builderCls.getMethod("prefixLength", int.class).invoke(builder, prefix);
            }
            if (dns1 != null) builder = builderCls.getMethod("dns1", String.class).invoke(builder, dns1);
            if (dns2 != null) builder = builderCls.getMethod("dns2", String.class).invoke(builder, dns2);
        }
        return builderCls.getMethod("build").invoke(builder);
    }

    private static Object buildProxySettings(String host, String port, String bypass) throws Exception {
        Class<?> cls = Class.forName("com.ubx.usdkplus.EthernetProxySettings");
        Object builder = cls.getMethod("builder").invoke(null);
        Class<?> builderCls = builder.getClass();
        if (host != null) {
            try {
                builder = builderCls.getMethod("hostname", String.class).invoke(builder, host);
            } catch (NoSuchMethodException e) {
                builder = builderCls.getMethod("host", String.class).invoke(builder, host);
            }
        }
        if (port != null) {
            int p = Integer.parseInt(port.trim());
            try {
                builder = builderCls.getMethod("port", int.class).invoke(builder, p);
            } catch (NoSuchMethodException e) {
                builder = builderCls.getMethod("proxyPort", int.class).invoke(builder, p);
            }
        }
        if (bypass != null) {
            try {
                builder = builderCls.getMethod("exclusionList", String.class).invoke(builder, bypass);
            } catch (NoSuchMethodException e) {
                builder = builderCls.getMethod("bypass", String.class).invoke(builder, bypass);
            }
        }
        return builderCls.getMethod("build").invoke(builder);
    }

    private static int netmaskToPrefix(String netmask) {
        String[] parts = netmask.trim().split("\\.");
        if (parts.length != 4) return -1;
        int prefix = 0;
        try {
            for (String p : parts) {
                int oct = Integer.parseInt(p);
                for (int i = 7; i >= 0; i--) {
                    if (((oct >> i) & 1) == 1) prefix++;
                    else return prefix;
                }
            }
        } catch (NumberFormatException e) {
            return -1;
        }
        return prefix;
    }

    private static void invokeVoidBool(Object target, String method, boolean arg) throws Exception {
        Method m = target.getClass().getMethod(method, boolean.class);
        m.invoke(target, arg);
    }

    private static void invokeVoidString(Object target, String method, String arg) throws Exception {
        Method m = target.getClass().getMethod(method, String.class);
        m.invoke(target, arg);
    }

    private static void invokeVoidObj(Object target, String method, Object arg) throws Exception {
        for (Method cand : target.getClass().getMethods()) {
            if (!cand.getName().equals(method) || cand.getParameterTypes().length != 1) continue;
            if (!cand.getParameterTypes()[0].isInstance(arg)
                    && !cand.getParameterTypes()[0].isAssignableFrom(arg.getClass())) {
                continue;
            }
            cand.invoke(target, arg);
            return;
        }
        throw new NoSuchMethodException(method + "(" + arg.getClass().getName() + ")");
    }

    private static void invokeVoid(Object target, String method) throws Exception {
        Method m = target.getClass().getMethod(method);
        m.invoke(target);
    }

    private static void append(StringBuilder sb, String key, String value) {
        sb.append(key).append('=');
        if (value != null) sb.append(value);
        sb.append('\n');
    }

    private static String bool01(Boolean v) {
        if (v == null) return "";
        return v ? "1" : "0";
    }

    /** 方法缺失或反射失败 → na；否则 0/1 */
    private static String host01OrNa(Object target, String method) {
        try {
            Method m = target.getClass().getMethod(method);
            Object r = m.invoke(target);
            if (r instanceof Boolean) return ((Boolean) r) ? "1" : "0";
            if (r == null) return "na";
            String s = String.valueOf(r).trim().toLowerCase();
            if (s.equals("1") || s.equals("true")) return "1";
            if (s.equals("0") || s.equals("false")) return "0";
            return "na";
        } catch (NoSuchMethodException e) {
            return "na";
        } catch (Throwable ignored) {
            return "na";
        }
    }

    private static String ethEnabled01(String raw) {
        if (raw == null) return "";
        String t = raw.trim().toLowerCase();
        if (t.equals("1") || t.equals("true") || t.equals("enable") || t.equals("enabled")) {
            return "1";
        }
        if (t.equals("0") || t.equals("false") || t.equals("disable") || t.equals("disabled")) {
            return "0";
        }
        return raw.trim();
    }

    private static Boolean invokeBool(Object target, String method) {
        try {
            Method m = target.getClass().getMethod(method);
            Object r = m.invoke(target);
            if (r instanceof Boolean) return (Boolean) r;
            if (r == null) return null;
            String s = String.valueOf(r).trim().toLowerCase();
            if (s.equals("1") || s.equals("true")) return true;
            if (s.equals("0") || s.equals("false")) return false;
            return null;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static String invokeString(Object target, String method) {
        try {
            Method m = target.getClass().getMethod(method);
            Object r = m.invoke(target);
            return r == null ? "" : String.valueOf(r);
        } catch (Throwable ignored) {
            return "";
        }
    }

    private static Object invokeObj(Object target, String method) {
        try {
            Method m = target.getClass().getMethod(method);
            return m.invoke(target);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static String strField(Object target, String... methods) {
        for (String method : methods) {
            try {
                Method m = target.getClass().getMethod(method);
                Object r = m.invoke(target);
                if (r != null) return String.valueOf(r);
            } catch (Throwable ignored) {
                /* try next */
            }
        }
        return "";
    }

    private static int intField(Object target, String method) {
        try {
            Method m = target.getClass().getMethod(method);
            Object r = m.invoke(target);
            if (r instanceof Number) return ((Number) r).intValue();
            if (r != null) return Integer.parseInt(String.valueOf(r).trim());
        } catch (Throwable ignored) {
            /* ignore */
        }
        return -1;
    }

    private static String assignmentMode(Object ip) {
        try {
            Method m = ip.getClass().getMethod("getMode");
            Object mode = m.invoke(ip);
            if (mode == null) return "";
            // 优先 Enum.name()，避免 toString/ordinal 误判
            String s =
                    mode instanceof Enum
                            ? ((Enum<?>) mode).name()
                            : String.valueOf(mode);
            String u = s.toUpperCase();
            if (u.contains("STATIC")) return "Static";
            if (u.contains("DHCP")) return "DHCP";
            return s;
        } catch (Throwable ignored) {
            return "";
        }
    }

    /**
     * 从 dumpsys ethernet 读真实分配方式，例如： {@code eth0: IP assignment: DHCP}
     */
    private static String readDumpsysIpAssignment() {
        Process p = null;
        try {
            p = Runtime.getRuntime().exec(new String[] {"dumpsys", "ethernet"});
            java.io.InputStream in = p.getInputStream();
            byte[] buf = new byte[16384];
            int n = in.read(buf);
            if (n <= 0) return "";
            String text = new String(buf, 0, n);
            java.util.regex.Matcher m =
                    java.util.regex.Pattern.compile(
                                    "IP assignment:\\s*(DHCP|STATIC)",
                                    java.util.regex.Pattern.CASE_INSENSITIVE)
                            .matcher(text);
            if (!m.find()) return "";
            return m.group(1).toUpperCase().contains("STATIC") ? "Static" : "DHCP";
        } catch (Throwable ignored) {
            return "";
        } finally {
            if (p != null) {
                try {
                    p.destroy();
                } catch (Throwable ignored) {
                    /* ignore */
                }
            }
        }
    }

    private static String prefixToNetmask(int prefix) {
        if (prefix < 0 || prefix > 32) return "";
        int mask = prefix == 0 ? 0 : 0xffffffff << (32 - prefix);
        return String.format(
                "%d.%d.%d.%d",
                (mask >>> 24) & 0xff,
                (mask >>> 16) & 0xff,
                (mask >>> 8) & 0xff,
                mask & 0xff);
    }
}
