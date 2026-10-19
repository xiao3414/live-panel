import { l1ModuleSummary } from "../navigation/oemProject";
import type { OemL1Node } from "../navigation/oemNavTree";

function moduleAbbr(m: OemL1Node): string {
  const map: Record<string, string> = {
    network: "NET",
    system: "SYS",
    application: "APP",
    package: "PKG",
    security: "SEC",
    "data-capture": "DC",
    "device-maintenance": "DM",
    profile: "PRF",
  };
  return map[m.id] ?? m.label.slice(0, 3).toUpperCase();
}

type Props = {
  modules: OemL1Node[];
  onSelectModule: (l1Id: string) => void;
};

/** 「配置项」入口：全页模块卡片，无侧栏 */
export function OemConfigModuleHub({ modules, onSelectModule }: Props) {
  return (
    <div className="oem-config-module-hub">
      <header className="oem-config-module-hub__head">
        <h2 className="oem-config-module-hub__title">配置模块</h2>
        <p className="oem-config-module-hub__lead">
          与 OEM 2.0 一级模块对齐。选择模块进入子域，查看设备实况并写回配置。
        </p>
      </header>
      <ul className="oem-config-module-hub__grid">
        {modules.map((m, index) => (
          <li key={m.id}>
            <button
              type="button"
              className={`oem-config-module-hub__card oem-config-module-hub__card--${m.id}`}
              onClick={() => onSelectModule(m.id)}
            >
              <span className="oem-config-module-hub__card-top">
                <span className="oem-config-module-hub__abbr">{moduleAbbr(m)}</span>
                <span className="oem-config-module-hub__index" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <span className="oem-config-module-hub__name">{m.label}</span>
              <span className="oem-config-module-hub__meta">{l1ModuleSummary(m)}</span>
              <span className="oem-config-module-hub__action" aria-hidden>
                进入
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
