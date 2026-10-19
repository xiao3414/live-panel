import type { LayoutWidget, ProbeMeta } from "../types";

/** 与 electron/layoutStore.defaultWidgetForProbe 保持一致 */
export function defaultWidgetForProbeMeta(
  meta: ProbeMeta,
  oemPath?: string,
): LayoutWidget {
  const id = `w_${meta.id.replace(/\./g, "_")}`;
  let w = 3;
  let h = 2;
  const t = meta.displayType;
  if (t === "toggle") {
    w = 2;
    h = 2;
  } else if (
    t === "wifi_general_settings_form" ||
    t === "wifi_network_form" ||
    t === "wifi_preference_settings_form" ||
    t === "wifi_whitelist_settings_form" ||
    t === "wifi_advanced_settings_form"
  ) {
    w = 6;
    h = 8;
  } else if (t === "group") {
    w = 6;
    h = 2;
  }
  return {
    id,
    probeIds: [meta.id],
    title: meta.item,
    oemPath,
    x: 0,
    y: 0,
    w,
    h,
  };
}
