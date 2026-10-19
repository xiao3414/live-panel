package android.device;

public class DeviceManagerEx {
    public String getCaptivePortalMode() {
        return "";
    }

    public void setCaptivePortalMode(String mode) {}

    public boolean getWifiNotificationEnabled() {
        return false;
    }

    public void setWifiNotificationEnabled(String value) {}

    public boolean getDisableFactoryReset() {
        return false;
    }

    public void setDisableFactoryReset(boolean disabled) {}

    public String getPackageVerifierUserConsent() {
        return "";
    }

    public void setPackageVerifierUserConsent(String value) {}

    public void setNoLockScreen(String value) {}

    public void setLockScreenDisabled(String value) {}

    public String getLockScreenTimeout() {
        return "";
    }

    public void setLockScreenTimeout(String ms) {}

    public String getScanKeyPassEnabled() {
        return "";
    }

    public void setScanKeyPassEnabled(String value) {}

    public boolean getDisableScreenShot() {
        return false;
    }

    public void setDisableScreenShot(boolean disabled) {}

    public String getScreenPinningEnabled() {
        return "";
    }

    public void setScreenPinningEnabled(String value) {}

    public boolean getKeyEnabled(int keyCode) {
        return true;
    }

    public void setKeyEnabled(int keyCode, boolean enabled) {}

    public boolean getCameraAccessAllowed() {
        return true;
    }

    public void setCameraAccessAllowed(boolean allowed) {}

    public boolean getMicrophoneAccessAllowed() {
        return true;
    }

    public void setMicrophoneAccessAllowed(boolean allowed) {}

    public String getClipboardDisabled() {
        return "";
    }

    public void setClipboardDisabled(String value) {}

    public boolean isClipboardAccessNotificationEnabled() {
        return true;
    }

    public void setClipboardAccessNotificationEnabled(boolean enabled) {}

    public boolean getShowPasswordWhenTypingEnabled() {
        return false;
    }

    public void setShowPasswordWhenTypingEnabled(boolean enabled) {}

    public String getLocationModeEnabled() {
        return "";
    }

    public void setLocationModeEnabled(String value) {}

    public void enableMount(boolean enable) {}

    public void setUsbMode(String mode) {}

    public String getSystemConfig(String key) {
        return "";
    }

    public void setSystemConfig(String key, String value) {}
}
