package com.urovo.livepanel.usdkbridge;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;

/** DT630 / UBX DataWedge：content://com.ubx.datawedge.provider/property_settings */
public final class ScanBridge {
    private static final Uri PROPERTY_SETTINGS =
            Uri.parse("content://com.ubx.datawedge.provider/property_settings");

    private ScanBridge() {}

    static String dumpAllProperties(Context context) {
        StringBuilder sb = new StringBuilder("SCANPROPS:");
        Cursor c = null;
        try {
            c =
                    context.getContentResolver()
                            .query(
                                    PROPERTY_SETTINGS,
                                    new String[] {"name", "value"},
                                    null,
                                    null,
                                    null);
            if (c == null) {
                return "ERR:DataWedge property_settings cursor null";
            }
            int n = 0;
            java.util.HashSet<String> seen = new java.util.HashSet<>();
            while (c.moveToNext()) {
                String name = c.getString(0);
                String value = c.getString(1);
                if (name == null || name.isEmpty()) continue;
                // 同名多行：保留首次（OEM 应用值），跳过后续 Default 模板行
                if (!seen.add(name)) continue;
                sb.append(name).append('=');
                if (value != null) sb.append(value);
                sb.append('\n');
                n++;
            }
            if (n == 0) {
                return "ERR:DataWedge property_settings empty";
            }
            return sb.toString();
        } catch (Throwable t) {
            String msg = t.getMessage();
            return "ERR:"
                    + (msg != null ? msg : t.getClass().getSimpleName());
        } finally {
            if (c != null) c.close();
        }
    }

    static String getProperty(Context context, String name) {
        if (name == null || name.isEmpty()) {
            return "ERR:missing property";
        }
        Cursor c = null;
        try {
            c =
                    context.getContentResolver()
                            .query(
                                    PROPERTY_SETTINGS,
                                    new String[] {"value"},
                                    "name=?",
                                    new String[] {name},
                                    null);
            if (c == null) {
                return "ERR:cursor null";
            }
            if (c.moveToFirst()) {
                String v = c.getString(0);
                return "VAL:" + (v != null ? v : "");
            }
            return "ERR:not found " + name;
        } catch (Throwable t) {
            String msg = t.getMessage();
            return "ERR:"
                    + (msg != null ? msg : t.getClass().getSimpleName());
        } finally {
            if (c != null) c.close();
        }
    }

    static String setProperty(Context context, String name, String value) {
        if (name == null || name.isEmpty() || value == null) {
            return "ERR:missing property or value";
        }
        // DT630 ScannerProvider.update() 常直接抛 IllegalStateException；
        // 优先走 DataWedge 配置广播，再尝试多种 ContentProvider 写法。
        String broadcastErr = trySetViaBroadcast(context, name, value);
        if (broadcastErr == null) return "OK";

        String[] attempts = new String[3];
        attempts[0] = tryUpdate(context, name, value, /*includeName*/ false);
        if ("OK".equals(attempts[0])) return "OK";
        attempts[1] = tryUpdate(context, name, value, /*includeName*/ true);
        if ("OK".equals(attempts[1])) return "OK";
        attempts[2] = tryInsert(context, name, value);
        if ("OK".equals(attempts[2])) return "OK";

        return "ERR:set failed broadcast="
                + broadcastErr
                + " update="
                + attempts[0]
                + " updateNamed="
                + attempts[1]
                + " insert="
                + attempts[2];
    }

    /** 官方 Default_scanner_property.xml 中的 property id（部分字段 ContentProvider 只认 id） */
    private static Integer propertyIdOf(String name) {
        if ("TRIGGERING_MODES".equals(name)) return 8;
        if ("GOOD_READ_BEEP_ENABLE".equals(name)) return 9;
        if ("GOOD_READ_VIBRATE_ENABLE".equals(name)) return 10;
        if ("SUSPENSION_BUTTON".equals(name)) return 8216;
        if ("MULTI_DECODE_MODE".equals(name)) return 44;
        if ("VIEW_FINDER_TARGET".equals(name)) return 2502;
        if ("VIEW_FINDER_SIZE".equals(name)) return 2106;
        if ("REAR_CAMERA_TORCH_CONTROL".equals(name)) return 2501;
        if ("DEC_Multiple_Decode_INTERVAL".equals(name)) return 2602;
        if ("DEC_Multiple_Decode_TIMEOUT".equals(name)) return 2600;
        if ("DEC_Multiple_Decode_MODE".equals(name)) return 2601;
        if ("CODE128_LENGTH1".equals(name)) return 1060;
        if ("I25_LENGTH1".equals(name)) return 552;
        if ("I25_LENGTH2".equals(name)) return 553;
        if ("GS1_EXP_LENGTH1".equals(name)) return 2084;
        if ("GS1_EXP_LENGTH2".equals(name)) return 2085;
        if ("VARIABLE_1D_MIN_LENGTH".equals(name)) return null;
        return null;
    }

    /** TRIGGERING_MODES：平台 0 与 10 等价（短按解码/超时） */
    private static boolean valueMatches(String name, String expected, String got) {
        if (expected == null || got == null) return false;
        if (expected.equals(got)) return true;
        if ("TRIGGERING_MODES".equals(name)) {
            boolean eShort = "0".equals(expected) || "10".equals(expected);
            boolean gShort = "0".equals(got) || "10".equals(got);
            return eShort && gShort;
        }
        return false;
    }

    private static String tryUpdate(
            Context context, String name, String value, boolean includeName) {
        try {
            android.content.ContentValues cv = new android.content.ContentValues();
            if (includeName) cv.put("name", name);
            Integer pid = propertyIdOf(name);
            if (pid != null) cv.put("propertyid", pid);
            cv.put("value", value);
            int rows =
                    context.getContentResolver()
                            .update(
                                    PROPERTY_SETTINGS,
                                    cv,
                                    includeName || pid == null ? "name=?" : "propertyid=?",
                                    new String[] {
                                        includeName || pid == null
                                                ? name
                                                : String.valueOf(pid)
                                    });
            if (rows > 0) return "OK";
            return "rows=" + rows;
        } catch (Throwable t) {
            return t.getClass().getSimpleName()
                    + (t.getMessage() != null ? (":" + t.getMessage()) : "");
        }
    }

    private static String tryInsert(Context context, String name, String value) {
        try {
            android.content.ContentValues cv = new android.content.ContentValues();
            cv.put("name", name);
            cv.put("value", value);
            android.net.Uri uri =
                    context.getContentResolver().insert(PROPERTY_SETTINGS, cv);
            if (uri != null) return "OK";
            return "insert null uri";
        } catch (Throwable t) {
            return t.getClass().getSimpleName()
                    + (t.getMessage() != null ? (":" + t.getMessage()) : "");
        }
    }

    /** @return null if broadcast sent without hard failure */
    private static String trySetViaBroadcast(
            Context context, String name, String value) {
        try {
            String[] actions =
                    new String[] {
                        "com.ubx.datawedge.api.ACTION_SETPROPERTY",
                        "com.urovo.scanner.scanwedge.api.SET_PROPERTY",
                        "com.urovo.scanwedge.api.SET_PROPERTY",
                        "android.intent.SCANNER_CONFIG",
                        "android.intent.action.SCANNER_CONFIG",
                    };
            Integer pid = propertyIdOf(name);
            for (String action : actions) {
                android.content.Intent intent = new android.content.Intent(action);
                intent.setPackage("com.ubx.datawedge");
                intent.putExtra("EXTRA_SETTING_STRING_NAME", name);
                intent.putExtra("EXTRA_SETTING_STRING_VALUE", value);
                intent.putExtra("propertyName", name);
                intent.putExtra("propertyValue", value);
                intent.putExtra("name", name);
                intent.putExtra("value", value);
                if (pid != null) {
                    intent.putExtra("EXTRA_SETTING_INT_ID", pid.intValue());
                    intent.putExtra("propertyId", pid.intValue());
                    intent.putExtra("propertyid", pid.intValue());
                }
                context.sendBroadcast(intent);
            }
            // 给 DataWedge 一点时间落库
            try {
                Thread.sleep(280);
            } catch (InterruptedException ignored) {
            }
            // 读回校验
            String got = getProperty(context, name);
            if (got != null && got.startsWith("VAL:")) {
                String v = got.substring(4);
                if (valueMatches(name, value, v)) return null;
            }
            return "no-echo-back got=" + got;
        } catch (Throwable t) {
            return t.getClass().getSimpleName()
                    + (t.getMessage() != null ? (":" + t.getMessage()) : "");
        }
    }
}
