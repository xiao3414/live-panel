package com.urovo.livepanel.usdkbridge;

import android.app.Activity;
import android.os.Bundle;

/** 供 adb am start 拉起进程，避免仅 Broadcast 时进程未起来 */
public class BridgeWakeActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        finish();
    }
}
