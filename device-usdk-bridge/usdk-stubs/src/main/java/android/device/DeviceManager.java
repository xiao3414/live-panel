package android.device;

import java.util.List;

/** compileOnly 桩；真机运行时由 Urovo 系统提供 android.device 实现 */
public class DeviceManager {
    public List<String> getWifiWhiteList() {
        return null;
    }

    public void setWifiWhiteList(String ssid, int p2, int action) {}

    public void setWifiWhiteList(List<String> ssids, int p2, int action) {}

    public boolean getUSBState() {
        return false;
    }

    public void controlAdb(boolean enable) {}

    public void controlUSB(boolean enable) {}

    public void saveLockPassword(String password, int quality) {}

    public void saveLockPattern(String pattern) {}

    public void clearLock() {}

    public String getSettingProperty(String key) {
        return "";
    }
}
