package com.urovo.livepanel.usdkbridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.device.DeviceManager;
import android.device.DeviceManagerEx;
import android.device.NetworkManagerEx;
import android.util.Log;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** 供 LivePanel PC 端 adb broadcast 调用 USDK（与 OEM 同路径） */
public class UsdkIniReceiver extends BroadcastReceiver {
    private static final String TAG = "LivePanelBridge";
    /** PC 端优先 run-as cat files/livepanel_usdk_ini.txt */
    private static final String RESULT_NAME = "livepanel_usdk_ini.txt";
    /** 部分 eng 机型的兜底路径 */
    private static final String OUT_TMP = "/data/local/tmp/livepanel_usdk_ini.txt";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || context == null) return;
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(
                        () -> {
                            try {
                                handle(app, intent);
                            } catch (Throwable fatal) {
                                Log.e(TAG, "handle crashed", fatal);
                                String reqId =
                                        intent.getStringExtra("reqId");
                                write(
                                        app,
                                        "ERR:"
                                                + (fatal.getMessage() != null
                                                        ? fatal.getMessage()
                                                        : fatal.getClass()
                                                                .getSimpleName()),
                                        reqId);
                            } finally {
                                pending.finish();
                            }
                        })
                .start();
    }

    private void handle(Context context, Intent intent) {
        String op = intent.getStringExtra("op");
        String reqId = intent.getStringExtra("reqId");
        try {
            if (op == null || op.isEmpty()) {
                write(context, "ERR:missing op", reqId);
                return;
            }
            if ("ping".equals(op)) {
                write(context, "OK", reqId);
                return;
            }
            if ("securityGetBatch".equals(op)) {
                String features = intent.getStringExtra("features");
                if (features == null || features.isEmpty()) {
                    write(context, "ERR:missing features", reqId);
                    return;
                }
                StringBuilder batch = new StringBuilder("BATCH:");
                for (String part : features.split(",")) {
                    String f = part.trim();
                    if (f.isEmpty()) continue;
                    batch.append(f)
                            .append('|')
                            .append(timedSecurityGet(context, f))
                            .append(',');
                }
                write(context, batch.toString(), reqId);
                return;
            }
            if ("securityGet".equals(op)) {
                String feature = intent.getStringExtra("feature");
                write(context, timedSecurityGet(context, feature), reqId);
                return;
            }
            if ("securitySet".equals(op)) {
                String feature = intent.getStringExtra("feature");
                String value = intent.getStringExtra("value");
                write(context, SecurityBridge.set(context, feature, value), reqId);
                return;
            }

            NetworkManagerEx nm = new NetworkManagerEx();
            DeviceManagerEx dmEx = new DeviceManagerEx();
            DeviceManager dm = new DeviceManager();

            if ("getIni".equals(op)) {
                String name = intent.getStringExtra("name");
                if (name == null || name.isEmpty()) {
                    write(context, "ERR:missing name");
                    return;
                }
                write(context, nm.getIni(name));
                return;
            }
            if ("putIni".equals(op)) {
                String name = intent.getStringExtra("name");
                String value = intent.getStringExtra("value");
                if (name == null || value == null) {
                    write(context, "ERR:missing name or value");
                    return;
                }
                nm.putIni(name, value);
                write(context, "OK");
                return;
            }
            if ("getWifiCountryCode".equals(op)) {
                write(context, nm.getWifiCountryCode());
                return;
            }
            if ("setWifiCountryCode".equals(op)) {
                String value = intent.getStringExtra("value");
                if (value == null) {
                    write(context, "ERR:missing value");
                    return;
                }
                nm.setWifiCountryCode(value);
                write(context, "OK");
                return;
            }
            if ("getCaptivePortalMode".equals(op)) {
                write(context, dmEx.getCaptivePortalMode());
                return;
            }
            if ("setCaptivePortalMode".equals(op)) {
                String value = intent.getStringExtra("value");
                if (value == null) {
                    write(context, "ERR:missing value");
                    return;
                }
                dmEx.setCaptivePortalMode(value);
                write(context, "OK");
                return;
            }
            if ("getWifiNotificationEnabled".equals(op)) {
                write(context, String.valueOf(dmEx.getWifiNotificationEnabled()));
                return;
            }
            if ("setWifiNotificationEnabled".equals(op)) {
                String value = intent.getStringExtra("value");
                if (value == null) {
                    write(context, "ERR:missing value");
                    return;
                }
                String normalized =
                        ("true".equalsIgnoreCase(value) || "1".equals(value)) ? "true" : "false";
                dmEx.setWifiNotificationEnabled(normalized);
                write(context, "OK");
                return;
            }
            if ("getWifiWakeupEnabled".equals(op)) {
                write(context, String.valueOf(nm.getWifiWakeupEnabled()));
                return;
            }
            if ("setWifiWakeupEnabled".equals(op)) {
                String value = intent.getStringExtra("value");
                if (value == null) {
                    write(context, "ERR:missing value");
                    return;
                }
                boolean on = "true".equalsIgnoreCase(value) || "1".equals(value);
                nm.setWifiWakeupEnabled(on);
                write(context, "OK");
                return;
            }
            if ("getWifiWhiteList".equals(op)) {
                List<String> list = dm.getWifiWhiteList();
                if (list == null || list.isEmpty()) {
                    write(context, "LIST:", reqId);
                    return;
                }
                StringBuilder sb = new StringBuilder("LIST:");
                for (int i = 0; i < list.size(); i++) {
                    if (i > 0) sb.append("|");
                    String s = list.get(i);
                    if (s != null) sb.append(s);
                }
                write(context, sb.toString(), reqId);
                return;
            }
            if ("setWifiWhiteList".equals(op)) {
                String action = intent.getStringExtra("action");
                if (action == null) {
                    write(context, "ERR:missing action");
                    return;
                }
                int act = Integer.parseInt(action);
                if (act == 0) {
                    dm.setWifiWhiteList((String) null, 0, 0);
                    write(context, "OK");
                    return;
                }
                String ssidsExtra = intent.getStringExtra("ssids");
                if (ssidsExtra != null && !ssidsExtra.isEmpty()) {
                    List<String> list = parseSsids(ssidsExtra);
                    if (list.isEmpty()) {
                        write(context, "ERR:missing ssid");
                        return;
                    }
                    if (list.size() == 1) {
                        dm.setWifiWhiteList(list.get(0), 0, act);
                    } else {
                        dm.setWifiWhiteList(list, 0, act);
                    }
                    write(context, "OK");
                    return;
                }
                String ssid = intent.getStringExtra("ssid");
                if (ssid == null || ssid.isEmpty()) {
                    write(context, "ERR:missing ssid");
                    return;
                }
                dm.setWifiWhiteList(ssid, 0, act);
                write(context, "OK");
                return;
            }
            write(context, "ERR:unknown op " + op, reqId);
        } catch (Throwable t) {
            Log.e(TAG, "USDK op failed: " + op, t);
            write(
                    context,
                    "ERR:"
                            + (t.getMessage() != null
                                    ? t.getMessage()
                                    : t.getClass().getSimpleName()),
                    reqId);
        }
    }

    /** 逗号分隔（避免 adb shell 把 | 当管道符） */
    private static List<String> parseSsids(String raw) {
        List<String> list = new ArrayList<>();
        for (String p : raw.split(",")) {
            if (p != null) {
                String t = p.trim();
                if (!t.isEmpty()) list.add(t);
            }
        }
        return list;
    }

    private static String timedSecurityGet(Context context, String feature) {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<String> f =
                    pool.submit(
                            new Callable<String>() {
                                @Override
                                public String call() {
                                    return SecurityBridge.get(context, feature);
                                }
                            });
            return f.get(18, TimeUnit.SECONDS);
        } catch (TimeoutException te) {
            return "ERR:USDK timeout";
        } catch (Exception e) {
            return "ERR:"
                    + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        } finally {
            pool.shutdownNow();
        }
    }

    private void write(Context context, String text) {
        write(context, text, null);
    }

    private void write(Context context, String text, String reqId) {
        String payload = text == null ? "" : text;
        Log.i(TAG, "RESULT:" + payload);
        if (reqId != null && !reqId.isEmpty()) {
            String safe = reqId.replaceAll("[^a-zA-Z0-9_-]", "");
            if (!safe.isEmpty()) {
                writeFile(new File(context.getFilesDir(), "livepanel_req_" + safe + ".txt"), payload);
                writeFile(new File("/data/local/tmp/livepanel_req_" + safe + ".txt"), payload);
                return;
            }
        }
        File appFile = new File(context.getFilesDir(), RESULT_NAME);
        writeFile(appFile, payload);
        writeFile(new File(OUT_TMP), payload);
    }

    private static void writeFile(File file, String payload) {
        try (FileWriter w = new FileWriter(file, false)) {
            w.write(payload);
        } catch (IOException e) {
            Log.w(TAG, "writeFile failed: " + file, e);
            return;
        }
        try {
            file.setReadable(true, false);
        } catch (Throwable ignored) {
            /* optional */
        }
    }
}
