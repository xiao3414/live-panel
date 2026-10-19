/**
 * MDM / 平台强制逻辑回归（无需连设备）
 */
import {
  parseDumpsysUserPolicy,
  parseDeviceManagedFromUser,
  parseHasEnabledDeviceAdmin,
  isEnterpriseMdmManaged,
  isPlayProtectMdmUiControlled,
  unknownSourcesBlockedByMdm,
} from "../dist-electron/adbMdmPolicy.js";

const DT610_USER = `Device managed: false
  Restrictions:
      no_adjust_volume
    Effective restrictions:
      no_adjust_volume
  Guest restrictions:
    no_install_unknown_sources`;

const DT610_DPM = `Enabled Device Admins (User 0, provisioningState: 0):

  mPasswordOwner=-1`;

const SOTI_DPM = `Enabled Device Admins (User 0):
    admin=ComponentInfo{net.soti.mobicontrol.androidwork}/`;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error("[verify:mdm] FAIL:", msg);
    failed++;
  }
}

const userParsed = parseDumpsysUserPolicy(DT610_USER);
ok(!userParsed.effective.has("no_install_unknown_sources"), "guest 模板不得进 effective");
ok(userParsed.effective.has("no_adjust_volume"), "user0 effective");

ok(!parseDeviceManagedFromUser(DT610_USER), "DT610 not device managed");
ok(!parseHasEnabledDeviceAdmin(DT610_DPM), "DT610 no admin");

const snap610 = {
  ...userParsed,
  global: new Set(),
  mdmLabel: "",
  deviceManaged: false,
  hasActiveDeviceAdmin: false,
};
ok(!isEnterpriseMdmManaged(snap610), "610 not enterprise");
ok(
  !isPlayProtectMdmUiControlled({ raw: "0", consent: "-1" }, snap610),
  "610 consent=-1 not platform locked",
);
ok(!unknownSourcesBlockedByMdm(snap610), "610 unknown source not mdm blocked");

const snapSoti = {
  effective: new Set(["ensure_verify_apps"]),
  global: new Set(),
  mdmLabel: "SOTI MobiControl",
  deviceManaged: true,
  hasActiveDeviceAdmin: true,
};
ok(isEnterpriseMdmManaged(snapSoti), "SOTI enterprise");
ok(
  isPlayProtectMdmUiControlled({ raw: "0", consent: "-1" }, snapSoti),
  "SOTI consent=-1 platform locked",
);

if (failed) process.exit(1);
console.log("[verify:mdm] OK");
