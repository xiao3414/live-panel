package com.urovo.livepanel.usdkbridge;

import android.device.ApplicationManagerEx;
import android.device.DeviceManager;
import android.device.DeviceManagerEx;

/** 按需加载 USDK，Settings 可读项不必先 new DeviceManagerEx */
final class UsdkLazy {
    private DeviceManagerEx ex;
    private DeviceManager dm;
    private ApplicationManagerEx appEx;

    DeviceManagerEx ex() throws Throwable {
        if (ex == null) ex = new DeviceManagerEx();
        return ex;
    }

    DeviceManager dm() throws Throwable {
        if (dm == null) dm = new DeviceManager();
        return dm;
    }

    ApplicationManagerEx appEx() throws Throwable {
        if (appEx == null) appEx = new ApplicationManagerEx();
        return appEx;
    }

    static String usdkErr(Throwable t) {
        return "ERR:usdk_not_available:"
                + (t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName());
    }
}
