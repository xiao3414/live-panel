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

    public boolean getGloveMode() {
        return false;
    }

    public void setGloveMode(boolean enabled) {}

    public boolean isDoNotDisturbEnabled() {
        return false;
    }

    public void setDoNotDisturbEnabled(boolean enabled) {}

    public String getNotificationBadgingEnabled() {
        return "0";
    }

    public void setNotificationBadgingEnabled(String enabled) {}

    public String getNotificationLightPulseEnabled() {
        return "0";
    }

    public void setNotificationLightPulseEnabled(String enabled) {}

    public String getFixedVolumeEnabled() {
        return "0";
    }

    public void setFixedVolumeEnabled(String enabled) {}

    public String getChargingSoundsEnabled() {
        return "0";
    }

    public void setChargingSoundsEnabled(String enabled) {}

    public String getScreenRotation() {
        return "0";
    }

    public void setScreenRotation(String rotation) {}

    public String getOrientationSuggestionDisabled() {
        return "false";
    }

    public void setOrientationSuggestionDisabled(String disabled) {}

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

    public boolean getBottomHostModeStatus() {
        return false;
    }

    public void enableBottomHostMode(boolean enable) {}

    public boolean getBackHostModeStatus() {
        return false;
    }

    public void enableBackHostMode(boolean enable) {}

    public String getEthernetEnabled() {
        return "false";
    }

    public void setEthernetEnabled(String enabled) {}

    public Object getEthernetIpSettings() {
        return null;
    }

    public void setEthernetIpSettings(Object settings) {}

    public Object getEthernetProxySettings() {
        return null;
    }

    public void setEthernetProxySettings(Object settings) {}

    public void restoreEthernetProxyDefault() {}

    public String getDefaultInputMethod() {
        return "";
    }

    public void setDefaultInputMethod(String imeId) {}

    public String getSystemLanguage() {
        return "";
    }

    public void setSystemLanguage(String language) {}

    public String getSpellCheckerEnabled() {
        return "0";
    }

    public void setSpellCheckerEnabled(String enabled) {}

    public String getPointerSpeed() {
        return "0";
    }

    public void setPointerSpeed(String speed) {}

    public String getDisablePopSoftinput() {
        return "0";
    }

    public void setDisablePopSoftinput(String enabled) {}

    public String getKeyboardFloatingWindow() {
        return "0";
    }

    public void setKeyboardFloatingWindow(String enabled) {}

    public String getFnKeyControlSoftInput() {
        return "0";
    }

    public void setFnKeyControlSoftInput(String enabled) {}

    public String getDisableImi() {
        return "";
    }

    public void setDisableImi(String value) {}

    public void setBottomBarEnable(boolean enable) {}

    public String getBottomBarEnable() {
        return "true";
    }

    public void enableSideAppBar(boolean enable) {}

    public boolean getSideAppBarStatus() {
        return false;
    }

    public void setSideAppBarLeft(boolean left) {}

    public boolean isSideAppBarLeft() {
        return true;
    }

    public void setMultiFingerScreenShotEnabled(String enabled) {}

    public String getMultiFingerScreenShotEnabled() {
        return "0";
    }

    public void enableQuicklyOpenCamera(boolean enable) {}

    public boolean getQuicklyOpenCameraStatus() {
        return false;
    }

    public void setGestureNavigationEnabled(boolean enabled) {}

    public boolean getGestureNavigationEnabled() {
        return false;
    }

    public void setLongPressPowerForAssistant(boolean enabled) {}

    public boolean getLongPressPowerForAssistant() {
        return false;
    }

    public void setBatteryPercentVisible(String visible) {}

    public String getBatteryPercentVisible() {
        return "0";
    }

    public void setPowerSaveModeEnabled(String enabled) {}

    public String getPowerSaveModeEnabled() {
        return "false";
    }

    public void setBatteryWorkMode(String mode) {}

    public String getBatteryWorkMode() {
        return "1";
    }

    public void setChargeLimitPercent(String percent) {}

    public String getChargeLimitPercent() {
        return "";
    }

    public void setLeftScanKeyWakeup(String enable) {}

    public String getLeftScanKeyWakeup() {
        return "false";
    }

    public void setRightScanKeyWakeup(String enable) {}

    public String getRightScanKeyWakeup() {
        return "false";
    }

    public void setPttKeyWakeupEnabled(String enabled) {}

    public String getPttKeyWakeupEnabled() {
        return "false";
    }

    public boolean getBatteryMonitorServiceEnabled() {
        return false;
    }

    public void setBatteryMonitorServiceEnabled(boolean enabled) {}

    public boolean getBatteryRetirementTipEnabled() {
        return false;
    }

    public void setBatteryRetirementTipEnabled(boolean enabled) {}

    public int getBatteryHealthRetirementThreshold() {
        return 0;
    }

    public void setBatteryHealthRetirementThreshold(int threshold) {}

    public int getBatteryCycleRetirementThreshold() {
        return 0;
    }

    public void setBatteryCycleRetirementThreshold(int threshold) {}

    public int getBatteryHighTemperatureThreshold() {
        return 0;
    }

    public void setBatteryHighTemperatureThreshold(int threshold) {}

    public void setBatteryOptimizationMode(String packageName, int mode) {}

    public int getBatteryOptimizationMode(String packageName) {
        return 0;
    }

    public void setPrivateDns(String dnsModeAndAddress) {}

    public String getPrivateDns() {
        return "0";
    }

    public void setNetHostname(String hostname) {}

    public String getNetHostname() {
        return "";
    }

    public void setDeviceName(String deviceName, int mode) {}

    public void setAirplaneModeEnabled(String enabled) {}

    public String getAirplaneModeEnabled() {
        return "0";
    }

    public void controlSwitchPolicy(String name, boolean value, int type) {}

    public boolean getSwitchStatus(String name) {
        return false;
    }
}
